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
import { normalizeFixtures, rankByDistance, ttlHoursFor, TIMEZONE, EXCLUDED_STATUS, todayInSaoPaulo } from "@/lib/gamesSearchCore";
import { haversineKm } from "@/lib/citiesCore";
import { resolveVenueInfo, resolveHomeTeams } from "@/lib/fixtureLocation";

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
  const homeTeams = await resolveHomeTeams(supabase, apiFixtures, venueInfo);
  const rows = normalizeFixtures(apiFixtures, {
    date,
    fetchedAt,
    findCity,
    countryCodeFromName,
    venueInfo: (id) => venueInfo.get(id),
    homeTeamInfo: (id) => homeTeams.get(id),
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

function toGame(g) {
  return {
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
    approxLocation: g.geo_precision !== "city",
  };
}

const NEARBY_WINDOW_DAYS = 10;

function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Quando não há jogo na data pedida: os jogos mais próximos dessa data (até
 * 10 dias antes ou depois) dentro do mesmo raio, lidos do calendário que já
 * temos guardado — não gasta nenhuma chamada da API.
 */
async function nearbyGames(supabase, { date, lat, lon, radiusKm }) {
  const today = todayInSaoPaulo();
  const from = shiftDate(date, -NEARBY_WINDOW_DAYS) < today ? today : shiftDate(date, -NEARBY_WINDOW_DAYS);
  const to = shiftDate(date, NEARBY_WINDOW_DAYS);
  const { data, error } = await supabase
    .from("fixtures_calendar")
    .select("fixture_id, kickoff, match_date, league_name, label, home_team, home_logo, away_team, away_logo, venue_name, venue_city, lat, lon, status, geo_precision")
    .gte("match_date", from)
    .lte("match_date", to)
    .neq("match_date", date)
    .not("lat", "is", null)
    .limit(5000);
  if (error) throw error;
  const dayGap = (m) => Math.abs(Date.parse(`${m}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000;
  return (data || [])
    .filter((r) => !EXCLUDED_STATUS.has(r.status))
    .map((r) => ({ ...r, km: haversineKm(lat, lon, r.lat, r.lon) }))
    .filter((r) => r.km <= radiusKm)
    .sort((a, b) => dayGap(a.match_date) - dayGap(b.match_date) || a.km - b.km)
    .slice(0, 6)
    .map((r) => ({
      id: r.fixture_id,
      kickoff: r.kickoff,
      league: r.league_name,
      leagueCountry: r.label,
      home: r.home_team,
      homeLogo: r.home_logo,
      away: r.away_team,
      awayLogo: r.away_logo,
      venue: r.venue_name,
      city: r.venue_city,
      distanceKm: Math.round(r.km),
      status: r.status,
      approxLocation: r.geo_precision !== "city",
    }));
}

export async function searchGames({ date, lat, lon, radiusKm, country }) {
  const meta = await ensureFresh(date);

  const supabase = supabaseAdmin();
  const { data: rows, error } = await supabase.from("fixtures_cache").select("*").eq("match_date", date);
  if (error) throw error;

  const { games, unconfirmed, unlocated } = rankByDistance(rows || [], { lat, lon, radiusKm, countryCode: country, countryCodeFromName });

  let nearby = [];
  if (games.length === 0 && unconfirmed.length === 0) {
    try {
      nearby = await nearbyGames(supabase, { date, lat, lon, radiusKm });
    } catch (e) {
      console.error("[gamesSearch] jogos próximos falhou:", e.message); // não derruba a busca
    }
  }

  return {
    date,
    radiusKm,
    nearby,
    total: games.length,
    unlocated,
    source: meta.source,
    stale: meta.stale,
    fetchedAt: meta.fetchedAt,
    games: games.map(toGame),
    unconfirmed: unconfirmed.map(toGame),
  };
}
