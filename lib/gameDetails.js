/**
 * Detalhes de um jogo que a pessoa registrou (escalação, gols, estatísticas,
 * estádio) — SÓ no servidor. Alimenta o modal "Detalhes da experiência".
 *
 * Jogo encerrado nunca muda: a resposta da API-Football fica guardada em
 * `fixture_details_cache` (ver supabase-fixture-details-cache.sql) e cada jogo
 * é consultado UMA vez só. Sem a tabela, funciona do mesmo jeito (só gasta mais
 * cota: guarda em memória por alguns minutos).
 */
import { countryCodeFromName } from "./cities";
import { countryKey, toApiCountryName } from "./countries";
import { apiGet } from "./fixtureLocation";
import { searchVenues } from "./footballApi";
import { FINISHED_STATUSES, shapeFixtureDetails } from "./gameDetailsCore";
import { roundLabel } from "./tripPlanner";
import { searchKey } from "./searchKey";

const CACHE_TABLE = "fixture_details_cache";
const MEMORY_TTL_MS = 10 * 60 * 1000;
const memory = new Map(); // fixtureId -> { at, value }

const venueImageUrl = (id) => (id ? `https://media.api-sports.io/football/venues/${id}.png` : null);

/**
 * Estádio no formato que a tela usa. A foto é a que a própria API devolveu
 * (`image`); só se ela não veio, monta o endereço padrão a partir do ID.
 */
export function venuePayload({ id = null, name = null, city = null, country = null, capacity = null, image = null } = {}) {
  return {
    id,
    name,
    city,
    country,
    capacity: capacity || null,
    // "Brasil", "Inglaterra"... (em português) não têm bandeira direto: converte pro nome que a API usa.
    cc: countryCodeFromName(toApiCountryName(country)) || countryCodeFromName(country) || null,
    image: image || venueImageUrl(id),
  };
}

/** Cadastro do estádio por ID: primeiro no nosso banco (venues_cache), depois na API (e guarda). */
export async function lookupVenueById(supabase, venueId) {
  if (!venueId) return null;
  let canCache = true;
  try {
    const { data: row, error } = await supabase.from("venues_cache").select("venue_id, name, city, country, capacity").eq("venue_id", venueId).maybeSingle();
    if (error) canCache = false;
    else if (row) return { id: venueId, name: row.name, city: row.city, country: row.country, capacity: row.capacity };
  } catch {
    canCache = false;
  }
  const res = await apiGet("/venues", { id: venueId });
  const v = Array.isArray(res) ? res[0] : null;
  if (canCache && Array.isArray(res)) {
    try {
      await supabase.from("venues_cache").upsert({ venue_id: venueId, name: v ? v.name : null, city: v ? v.city : null, country: v ? v.country : null, capacity: v ? v.capacity : null, fetched_at: new Date().toISOString() });
    } catch {
      // guardar é só economia de cota
    }
  }
  return v ? { id: venueId, name: v.name, city: v.city, country: v.country, capacity: v.capacity, image: v.image || null } : null;
}

const WORLD_REGION = /^(world|europe|south america|north america|asia|africa|oceania)$/i;

/**
 * Procura o estádio pelo NOME na API-Football (a busca fica em cache por 7 dias,
 * então repetir não gasta cota). Só devolve quando tem CERTEZA: o nome tem que
 * ser igual ou conter o que foi digitado, e o país (se informado) tem que bater.
 * Dois estádios igualmente prováveis = não chuta (devolve null).
 */
export async function findVenueByName({ name, city, country } = {}) {
  const want = searchKey(name);
  if (want.length < 3) return null;
  let list;
  try {
    list = await searchVenues(name);
  } catch {
    return null; // cota/erro da API: segue sem
  }
  if (!Array.isArray(list) || list.length === 0) return null;

  const wantCountry = country && !WORLD_REGION.test(String(country).trim()) ? countryKey(country) : "";
  const wantCity = searchKey(city);
  const wantTokens = want.split(" ").filter((t) => t.length >= 3);
  const scored = list
    .map((v) => {
      const n = searchKey(v.name);
      let score = 0;
      if (n === want) score += 4;
      else if (n.includes(want) || want.includes(n)) score += 3;
      else {
        const words = n.split(" ");
        const shared = wantTokens.filter((t) => words.includes(t)).length;
        if (shared > 0 && shared >= Math.ceil(wantTokens.length / 2)) score += 2;
      }
      if (score === 0) return { v, score: 0 };
      if (wantCountry && v.country) score += countryKey(v.country) === wantCountry ? 2 : -1;
      if (wantCity && v.city && searchKey(v.city) === wantCity) score += 1;
      return { v, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 4) return null; // nome parecido + (nome igual ou país batendo)
  if (scored[1] && best.score - scored[1].score < 1) return null; // empate: melhor não chutar
  const v = best.v;
  return { id: v.id ?? null, name: v.name, city: v.city, country: v.country, capacity: v.capacity || null, image: v.image || null };
}

/**
 * Estádio de um jogo SEM vínculo com a API (registrado à mão ou importado sem
 * reconhecer): acha pelo NOME no cadastro que já temos e, se não achar (ou
 * faltar a capacidade), procura na API-Football pelo nome.
 */
export async function venueByName(supabase, game) {
  const base = venuePayload({ name: game.stadium || null, city: game.city || null, country: game.country || null });
  if (!game.stadium) return base;

  let hit = null;
  try {
    const like = String(game.stadium).replace(/[%_\\]/g, (c) => `\\${c}`);
    const { data } = await supabase.from("venues_cache").select("venue_id, name, city, country, capacity").ilike("name", like).limit(5);
    hit = (data || []).find((r) => r.capacity) || (data || [])[0] || null;
  } catch {
    // sem cadastro: segue pra busca na API
  }
  if (hit && hit.capacity) {
    return venuePayload({ id: hit.venue_id, name: game.stadium, city: hit.city || game.city, country: game.country || hit.country, capacity: hit.capacity });
  }

  const found = await findVenueByName({ name: game.stadium, city: game.city, country: game.country });
  if (found && found.id) {
    try {
      await supabase.from("venues_cache").upsert({ venue_id: found.id, name: found.name, city: found.city, country: found.country, capacity: found.capacity, fetched_at: new Date().toISOString() });
    } catch {
      // guardar é só economia
    }
    return venuePayload({ id: found.id, name: game.stadium, city: found.city || game.city, country: game.country || found.country, capacity: found.capacity, image: found.image });
  }
  if (hit) return venuePayload({ id: hit.venue_id, name: game.stadium, city: hit.city || game.city, country: game.country || hit.country, capacity: hit.capacity });
  return base;
}

/** O jogo na API, com tudo que a tela precisa. Cada parte que a API não embutir é buscada à parte. */
async function loadFixtureRaw(fixtureId) {
  const res = await apiGet("/fixtures", { id: fixtureId });
  if (res === undefined) return { error: "api" };
  const fx = res[0];
  if (!fx) return { error: "not-found" };
  for (const [key, path] of [["events", "/fixtures/events"], ["lineups", "/fixtures/lineups"], ["statistics", "/fixtures/statistics"], ["players", "/fixtures/players"]]) {
    if (!Array.isArray(fx[key])) {
      const part = await apiGet(path, { fixture: fixtureId });
      fx[key] = Array.isArray(part) ? part : [];
    }
  }
  return { fx };
}

/**
 * Resumo do jogo pela API-Football (ver gameDetailsCore.shapeFixtureDetails).
 * Devolve { details } ou { error: "api" | "not-found" }.
 */
export async function getFixtureDetails(supabase, fixtureId) {
  const key = String(fixtureId);
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < MEMORY_TTL_MS) return { details: hit.value, cached: true };

  let tableOk = true;
  try {
    const { data, error } = await supabase.from(CACHE_TABLE).select("payload").eq("fixture_id", fixtureId).maybeSingle();
    if (error) tableOk = false;
    else if (data && data.payload) {
      memory.set(key, { at: Date.now(), value: data.payload });
      return { details: data.payload, cached: true };
    }
  } catch {
    tableOk = false;
  }

  const loaded = await loadFixtureRaw(fixtureId);
  if (loaded.error) return { error: loaded.error };
  const fx = loaded.fx;
  const apiVenue = (fx.fixture && fx.fixture.venue) || {};
  let venueId = apiVenue.id || null;
  let info = (await lookupVenueById(supabase, venueId)) || {};
  if (!venueId && apiVenue.name) {
    // A API às vezes manda o jogo sem ID de estádio: procura pelo nome (e cidade).
    const found = await findVenueByName({ name: apiVenue.name, city: apiVenue.city, country: fx.league && fx.league.country });
    if (found && found.id) {
      venueId = found.id;
      info = found;
    }
  }
  const venue = venuePayload({
    id: venueId,
    name: apiVenue.name || info.name || null,
    // O cadastro do estádio (por ID) escreve a cidade certa; o texto do jogo às vezes não ("Bello Harisanta" por Belo Horizonte).
    city: info.city || apiVenue.city || null,
    country: info.country || null,
    capacity: info.capacity || null,
    image: info.image || null,
  });
  const details = shapeFixtureDetails(fx, { venue, roundLabel: roundLabel(fx.league && fx.league.round) });

  if (details.status.short && FINISHED_STATUSES.has(details.status.short)) {
    memory.set(key, { at: Date.now(), value: details });
    if (tableOk) {
      try {
        await supabase.from(CACHE_TABLE).upsert({ fixture_id: fixtureId, payload: details, status: details.status.short, fetched_at: new Date().toISOString() });
      } catch {
        // sem a tabela: só não guarda
      }
    }
  }
  return { details };
}

/** Só pros testes. */
export function _clearMemoryCache() {
  memory.clear();
}
