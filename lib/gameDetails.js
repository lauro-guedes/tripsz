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
import { apiGet } from "./fixtureLocation";
import { FINISHED_STATUSES, shapeFixtureDetails } from "./gameDetailsCore";
import { roundLabel } from "./tripPlanner";

const CACHE_TABLE = "fixture_details_cache";
const MEMORY_TTL_MS = 10 * 60 * 1000;
const memory = new Map(); // fixtureId -> { at, value }

const venueImageUrl = (id) => (id ? `https://media.api-sports.io/football/venues/${id}.png` : null);

/** Estádio no formato que a tela usa. */
export function venuePayload({ id = null, name = null, city = null, country = null, capacity = null } = {}) {
  return {
    id,
    name,
    city,
    country,
    capacity: capacity || null,
    cc: countryCodeFromName(country) || null,
    image: venueImageUrl(id),
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
  return v ? { id: venueId, name: v.name, city: v.city, country: v.country, capacity: v.capacity } : null;
}

/** Jogo registrado à mão: acha o estádio pelo NOME no cadastro que já temos (sem gastar cota). */
export async function venueByName(supabase, game) {
  const base = venuePayload({ name: game.stadium || null, city: game.city || null, country: game.country || null });
  if (!game.stadium) return base;
  try {
    const like = String(game.stadium).replace(/[%_\\]/g, (c) => `\\${c}`);
    const { data } = await supabase.from("venues_cache").select("venue_id, name, city, country, capacity").ilike("name", like).limit(5);
    const hit = (data || []).find((r) => r.capacity) || (data || [])[0];
    if (hit) return venuePayload({ id: hit.venue_id, name: game.stadium, city: game.city || hit.city, country: game.country || hit.country, capacity: hit.capacity });
  } catch {
    // sem cadastro: segue só com o que a pessoa registrou
  }
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
  const venueId = fx.fixture && fx.fixture.venue ? fx.fixture.venue.id : null;
  const info = (await lookupVenueById(supabase, venueId)) || {};
  const venue = venuePayload({
    id: venueId,
    name: (fx.fixture.venue && fx.fixture.venue.name) || info.name || null,
    city: (fx.fixture.venue && fx.fixture.venue.city) || info.city || null,
    country: info.country || null,
    capacity: info.capacity || null,
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
