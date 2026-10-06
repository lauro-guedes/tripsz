/**
 * Busca de jogos por cidade — SÓ no servidor.
 *
 * Como funciona, em resumo:
 *  1. A API-Football devolve TODOS os jogos de uma data numa chamada só.
 *  2. A gente guarda os jogos das ligas curadas (já com a coordenada da
 *     cidade do estádio) na tabela fixtures_cache, por data.
 *  3. Cada busca de usuário lê desse cache e calcula a distância — não
 *     gasta nenhuma chamada da API. Só a primeira busca de uma data (ou a
 *     primeira depois do cache vencer) vai na API.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { findCity, countryCodeFromName } from "@/lib/cities";
import { normalizeFixtures, venueIdsNeedingLookup, rankByDistance, ttlHoursFor, TIMEZONE } from "@/lib/gamesSearchCore";

const BASE_URL = "https://v3.football.api-sports.io";

/** A API não libera essa data no plano atual. */
export class DateNotAvailableError extends Error {}
/** Acabou a cota de chamadas do dia. */
export class QuotaError extends Error {}

async function fetchFixturesByDate(date) {
  const url = new URL(`${BASE_URL}/fixtures`);
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", TIMEZONE);

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY },
    // Esses dados mudam (horário, adiamento) — o cache de verdade é o
    // nosso, no banco, com validade controlada. Não usa o cache do Next.
    cache: "no-store",
  });
  const data = await res.json();

  // A API devolve errors: [] quando está tudo certo e um objeto quando não.
  const errors = data.errors && !Array.isArray(data.errors) ? data.errors : null;
  if (errors && Object.keys(errors).length > 0) {
    if (errors.plan) throw new DateNotAvailableError(errors.plan);
    if (errors.requests || errors.rateLimit) throw new QuotaError(JSON.stringify(errors));
    throw new Error(`API-Football: ${JSON.stringify(errors)}`);
  }
  if (!res.ok) throw new Error(`API-Football: HTTP ${res.status}`);

  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  if (remaining !== null) console.log(`[API-Football] requisições restantes hoje: ${remaining}`);

  return data.response || [];
}


// Quantos estádios, no máximo, a gente consulta por atualização de data.
// Cada consulta gasta uma chamada da API; o resto fica pra próxima vez
// (e o que já foi consultado nunca é consultado de novo).
const MAX_VENUE_LOOKUPS_PER_REFRESH = 8;

/**
 * Consulta um estádio pelo ID no cadastro da API-Football.
 * Devolve { city, country, name }, null (estádio não existe no cadastro)
 * ou undefined (a API reclamou — cota/limite — então não grava nada).
 */
async function fetchVenueById(id) {
  try {
    const url = new URL(`${BASE_URL}/venues`);
    url.searchParams.set("id", String(id));
    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY },
      cache: "no-store",
    });
    const data = await res.json();
    const errors = data.errors && !Array.isArray(data.errors) ? data.errors : null;
    if (errors && Object.keys(errors).length > 0) return undefined;
    const v = (data.response || [])[0];
    return v ? { city: v.city || null, country: v.country || null, name: v.name || null } : null;
  } catch {
    return undefined;
  }
}

/**
 * A API escreve algumas cidades do jeito errado nos jogos ("Bello
 * Harisanta" por Belo Horizonte), mas no cadastro do estádio, por ID, o
 * nome vem certo. Pros jogos que ficaram sem localização, busca no
 * cadastro — primeiro no nosso banco (venues_cache), depois na API.
 * Nunca derruba a atualização: se algo falhar, devolve o que tiver.
 */
async function resolveVenueInfo(supabase, apiFixtures) {
  const info = new Map();
  try {
    const ids = venueIdsNeedingLookup(apiFixtures, { findCity, countryCodeFromName });
    if (ids.length === 0) return info;

    const { data: cached, error: cacheError } = await supabase.from("venues_cache").select("venue_id, city, country").in("venue_id", ids);
    if (cacheError) {
      // Sem a tabela (ainda não rodaram o SQL-3?) não adianta consultar a
      // API: a resposta não ficaria guardada e gastaria cota à toa.
      console.error("[gamesSearch] venues_cache indisponível:", cacheError.message);
      return info;
    }
    for (const r of cached || []) info.set(r.venue_id, { city: r.city, country: r.country });

    const missing = ids.filter((id) => !info.has(id)).slice(0, MAX_VENUE_LOOKUPS_PER_REFRESH);
    for (const id of missing) {
      const v = await fetchVenueById(id);
      if (v === undefined) break; // a API está reclamando: para por aqui, tenta de novo na próxima
      await supabase.from("venues_cache").upsert({
        venue_id: id,
        name: v ? v.name : null,
        city: v ? v.city : null,
        country: v ? v.country : null,
        fetched_at: new Date().toISOString(),
      });
      if (v) info.set(id, v);
    }
  } catch (e) {
    console.error("[gamesSearch] consulta de estádios falhou (segue sem ela):", e.message);
  }
  return info;
}

/** Garante que o cache dessa data está fresco; só vai na API se precisar. */
async function ensureFresh(date) {
  const supabase = supabaseAdmin();
  const { data: log } = await supabase
    .from("fixtures_fetch_log")
    .select("fetched_at")
    .eq("match_date", date)
    .maybeSingle();

  const ageHours = log ? (Date.now() - new Date(log.fetched_at).getTime()) / 3600000 : Infinity;
  if (log && ageHours < ttlHoursFor(date)) {
    return { source: "cache", fetchedAt: log.fetched_at, stale: false };
  }

  let apiFixtures;
  try {
    apiFixtures = await fetchFixturesByDate(date);
  } catch (e) {
    // Se a API falhou mas a gente já tinha os jogos dessa data, melhor
    // mostrar os (um pouco velhos) do que mostrar nada.
    if (log && !(e instanceof DateNotAvailableError)) {
      console.error("[gamesSearch] API falhou, servindo cache antigo:", e.message);
      return { source: "cache", fetchedAt: log.fetched_at, stale: true };
    }
    throw e;
  }

  const fetchedAt = new Date().toISOString();
  const venueInfo = await resolveVenueInfo(supabase, apiFixtures);
  const rows = normalizeFixtures(apiFixtures, {
    date,
    fetchedAt,
    findCity,
    countryCodeFromName,
    venueInfo: (id) => venueInfo.get(id),
  });

  // Upsert primeiro e só depois apaga o que sobrou de velho — assim, uma
  // busca simultânea nunca enxerga a data "vazia" no meio da atualização.
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase
      .from("fixtures_cache")
      .upsert(rows.slice(i, i + 400), { onConflict: "fixture_id" });
    if (error) throw error;
  }
  await supabase.from("fixtures_cache").delete().eq("match_date", date).lt("fetched_at", fetchedAt);
  await supabase
    .from("fixtures_fetch_log")
    .upsert({ match_date: date, fetched_at: fetchedAt, total: apiFixtures.length, kept: rows.length });

  return { source: "api", fetchedAt, stale: false };
}

export async function searchGames({ date, lat, lon, radiusKm }) {
  const meta = await ensureFresh(date);

  const supabase = supabaseAdmin();
  const { data: rows, error } = await supabase.from("fixtures_cache").select("*").eq("match_date", date);
  if (error) throw error;

  const { games, unlocated } = rankByDistance(rows || [], { lat, lon, radiusKm });

  return {
    date,
    radiusKm,
    total: games.length,
    unlocated,
    source: meta.source,
    stale: meta.stale,
    fetchedAt: meta.fetchedAt,
    games: games.map((g) => ({
      id: g.fixture_id,
      kickoff: g.kickoff,
      league: g.league_name,
      leagueCountry: g.league_country,
      home: g.home_team,
      homeLogo: g.home_logo,
      away: g.away_team,
      awayLogo: g.away_logo,
      venue: g.venue_name,
      city: g.venue_city,
      distanceKm: g.distance_km,
      status: g.status,
      approxLocation: g.geo_precision === "city-approx",
    })),
  };
}
