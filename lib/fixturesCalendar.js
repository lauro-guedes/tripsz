/**
 * Calendário de jogos REAIS do Montar Viagem — SÓ no servidor.
 *
 * Como funciona:
 *  1. Pra cada liga/temporada, uma chamada à API-Football traz TODOS os jogos
 *     dos próximos ~9 meses (e uma por mês traz os times com estádio e
 *     capacidade). Isso é guardado na tabela fixtures_calendar, já com o local
 *     de cada jogo (cidade, coordenada, país).
 *  2. Antes de cada consulta, só as ligas dos países pedidos são conferidas: se
 *     foram atualizadas há menos de 12h, nem vai à API.
 *  3. O Montar Viagem lê da tabela — nenhuma busca de usuário gasta cota.
 */
import { findCity, countryCodeFromName } from "@/lib/cities";
import { apiGet, resolveVenueInfo, resolveHomeTeams } from "@/lib/fixtureLocation";
import { TIMEZONE, todayInSaoPaulo } from "@/lib/gamesSearchCore";
import { LEAGUE_META, WIZARD_COUNTRIES, leagueIdsForCountries, seasonsForWindow, toCalendarRows, labelForRow, isPlayable } from "@/lib/calendarCore";

export const MAX_AGE_HOURS = 12; // depois disso, a liga é conferida de novo na API
export const HORIZON_DAYS = 270; // até onde o calendário olha pra frente
const TEAMS_MAX_AGE_DAYS = 30; // estádio/capacidade dos times quase não mudam
const LEAGUE_CONCURRENCY = 4;
const PAGE = 1000; // limite de linhas por consulta do Supabase

/** Flexibilidade das datas (passo "Datas") em dias pra cada lado. */
export const FLEX_PAD_DAYS = { fixed: 0, some: 7, flex: 21 };

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function runPool(items, limit, worker) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  });
  await Promise.all(lanes);
}

/** Lê TODAS as linhas de uma consulta, página por página (o Supabase devolve no máx. 1000 por vez). */
async function selectAll(buildQuery) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function upsertInChunks(supabase, table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 400), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/** Atualiza UMA liga numa temporada: jogos + (uma vez por mês) estádios dos times. */
export async function syncLeagueSeason(supabase, leagueId, season, { from, to, log }) {
  const fetchedAt = new Date().toISOString();
  const fixtures = await apiGet("/fixtures", { league: leagueId, season, from, to, timezone: TIMEZONE });
  if (fixtures === undefined) return { ok: false, reason: "api" }; // a API reclamou (cota/limite)

  // 1) estádio e capacidade de todos os times da liga, de uma vez (1 chamada por mês)
  let teamsSyncedAt = log?.teams_synced_at || null;
  const teamsAgeDays = teamsSyncedAt ? (Date.now() - new Date(teamsSyncedAt).getTime()) / 86400000 : Infinity;
  if (teamsAgeDays > TEAMS_MAX_AGE_DAYS) {
    const teams = await apiGet("/teams", { league: leagueId, season });
    if (teams !== undefined) {
      const teamRows = teams
        .filter((t) => t.team?.id)
        .map((t) => ({
          team_id: t.team.id,
          venue_name: t.venue?.name || null,
          venue_city: t.venue?.city || null,
          venue_capacity: t.venue?.capacity || null,
          country: t.team?.country || null,
          fetched_at: fetchedAt,
        }));
      await upsertInChunks(supabase, "team_home_venues", teamRows, "team_id");
      teamsSyncedAt = fetchedAt;
    }
  }

  // 2) o que já sabemos dos times da casa desses jogos (do nosso banco)
  const teamMap = new Map();
  const homeIds = [...new Set(fixtures.map((f) => f.teams?.home?.id).filter(Boolean))];
  for (let i = 0; i < homeIds.length; i += 200) {
    const { data } = await supabase.from("team_home_venues").select("team_id, venue_name, venue_city, venue_capacity, country").in("team_id", homeIds.slice(i, i + 200));
    for (const r of data || []) teamMap.set(r.team_id, { city: r.venue_city, country: r.country, venueName: r.venue_name, venueCapacity: r.venue_capacity });
  }

  // 3) estádio por ID (os poucos jogos cujo nome de cidade não casou) e, por fim, times que ainda faltam
  const venueInfo = await resolveVenueInfo(supabase, fixtures);
  const extraTeams = await resolveHomeTeams(supabase, fixtures, venueInfo);
  for (const [id, v] of extraTeams) if (!teamMap.has(id)) teamMap.set(id, v);

  const rows = toCalendarRows(fixtures, {
    fetchedAt,
    findCity,
    countryCodeFromName,
    venueInfo: (id) => venueInfo.get(id),
    homeTeamInfo: (id) => teamMap.get(id),
  }).map((r) => ({ ...r, league_season: r.league_season ?? season }));

  // Upsert primeiro e só depois apaga o que sobrou de velho (jogo que saiu da
  // lista) — assim uma consulta simultânea nunca vê a liga "vazia".
  await upsertInChunks(supabase, "fixtures_calendar", rows, "fixture_id");
  await supabase.from("fixtures_calendar").delete().eq("league_id", leagueId).eq("league_season", season).gte("match_date", from).lt("fetched_at", fetchedAt);
  const { error: logError } = await supabase.from("calendar_sync_log").upsert(
    { league_id: leagueId, season, fetched_at: fetchedAt, covers_until: to, total: fixtures.length, kept: rows.length, teams_synced_at: teamsSyncedAt },
    { onConflict: "league_id,season" }
  );
  if (logError) throw new Error(`calendar_sync_log: ${logError.message}`);
  return { ok: true, total: fixtures.length, kept: rows.length, fetchedAt };
}

/**
 * Garante que o calendário dessas ligas está fresco. Só vai à API pra liga
 * que nunca foi lida, que tem mais de MAX_AGE_HOURS ou que não cobre a data
 * pedida. Devolve um resumo por liga/temporada.
 */
export async function ensureCalendar(supabase, leagueIds, { requiredTo } = {}) {
  const today = todayInSaoPaulo();
  const from = addDays(today, -1);
  const to = addDays(today, HORIZON_DAYS);
  const needTo = requiredTo && requiredTo < to ? requiredTo : to;

  const tasks = [];
  for (const id of leagueIds) {
    const m = LEAGUE_META[id];
    if (!m) continue;
    for (const season of seasonsForWindow(m, from, to)) tasks.push({ id, season });
  }
  const logs = await selectAll(() => supabase.from("calendar_sync_log").select("*").in("league_id", leagueIds).order("league_id", { ascending: true }).order("season", { ascending: true }));
  const logBy = new Map(logs.map((l) => [`${l.league_id}:${l.season}`, l]));
  const logsFound = logs.length;

  const results = [];
  await runPool(tasks, LEAGUE_CONCURRENCY, async ({ id, season }) => {
    const log = logBy.get(`${id}:${season}`);
    const ageHours = log ? (Date.now() - new Date(log.fetched_at).getTime()) / 3600000 : Infinity;
    if (log && ageHours < MAX_AGE_HOURS && log.covers_until >= needTo) {
      results.push({ leagueId: id, season, source: "cache", why: "recente", fetchedAt: log.fetched_at });
      return;
    }
    // Por que precisou ler de novo (aparece na resposta da rota, pra dar pra conferir):
    const why = !log ? "sem registro" : !(ageHours < MAX_AGE_HOURS) ? `registro velho (${Number.isFinite(ageHours) ? ageHours.toFixed(1) : "?"}h)` : `registro cobre só até ${log.covers_until}, pedido até ${needTo}`;
    try {
      const r = await syncLeagueSeason(supabase, id, season, { from, to, log });
      if (r.ok) results.push({ leagueId: id, season, source: "api", why, fetchedAt: r.fetchedAt, total: r.total, kept: r.kept });
      // API reclamou: se já tinha dado dessa liga, segue com ele (um pouco velho) em vez de falhar.
      else results.push({ leagueId: id, season, source: log ? "cache" : "error", why, stale: !!log, fetchedAt: log?.fetched_at || null, error: log ? null : r.reason });
    } catch (e) {
      console.error(`[fixturesCalendar] liga ${id}/${season} falhou:`, e.message);
      results.push({ leagueId: id, season, source: log ? "cache" : "error", why, stale: !!log, fetchedAt: log?.fetched_at || null, error: log ? null : e.message });
    }
  });
  results.logsFound = logsFound;
  return results.sort((a, b) => a.leagueId - b.leagueId || a.season - b.season);
}

function toGame(row) {
  return {
    id: row.fixture_id,
    kickoff: row.kickoff,
    matchDate: row.match_date,
    country: row.label,
    competition: { id: row.league_id, name: row.league_name, type: row.competition_type, round: row.league_round, season: row.league_season },
    home: { id: row.home_team_id, name: row.home_team, logo: row.home_logo },
    away: { id: row.away_team_id, name: row.away_team, logo: row.away_logo },
    venue: { name: row.venue_name, city: row.venue_city, capacity: row.venue_capacity },
    lat: row.lat,
    lon: row.lon,
    cc: row.venue_cc,
    approxLocation: row.geo_precision === "team-home" || row.geo_precision === "city-approx",
    status: row.status,
  };
}

/**
 * Jogos reais dos países pedidos entre duas datas (inclusive), em ordem de
 * horário. "unlocated" são os jogos dos países pedidos que ainda não têm
 * local conhecido (ficam de fora do roteiro, mas contamos pra ser transparente) —
 * "unlocatedGames" traz os primeiros, pra dar pra ver o que está faltando.
 */
export async function getCandidates(supabase, { labels, from, to }) {
  const leagueIds = leagueIdsForCountries(labels);
  const rows = await selectAll(() =>
    supabase.from("fixtures_calendar").select("*").in("league_id", leagueIds).gte("match_date", from).lte("match_date", to).order("kickoff", { ascending: true }).order("fixture_id", { ascending: true })
  );
  const wanted = new Set(labels);
  const games = [];
  let unlocated = 0;
  const unlocatedGames = [];
  for (const row of rows) {
    if (!isPlayable(row.status)) continue;
    const label = labelForRow(row);
    if (!label || !wanted.has(label)) continue;
    if (row.lat == null || row.lon == null) {
      unlocated++;
      if (unlocatedGames.length < 40) {
        unlocatedGames.push({ id: row.fixture_id, matchDate: row.match_date, country: label, competition: row.league_name, home: row.home_team, away: row.away_team, venueName: row.venue_name, venueCity: row.venue_city });
      }
      continue;
    }
    games.push(toGame({ ...row, label }));
  }
  return { games, unlocated, unlocatedGames };
}

/** Os jogos reais mais próximos ANTES e DEPOIS de uma janela (pra sugerir quando a janela está vazia). */
export async function getNearest(supabase, { labels, from, to, perSide = 6 }) {
  const leagueIds = leagueIdsForCountries(labels);
  const today = todayInSaoPaulo();
  const wanted = new Set(labels);
  const pick = (rows) => {
    const out = [];
    for (const row of rows) {
      if (!isPlayable(row.status) || row.lat == null) continue;
      const label = labelForRow(row);
      if (label && wanted.has(label)) out.push(toGame({ ...row, label }));
    }
    return out;
  };
  const base = () => supabase.from("fixtures_calendar").select("*").in("league_id", leagueIds);
  const { data: beforeRows } = await base().gte("match_date", today).lt("match_date", from).order("kickoff", { ascending: false }).limit(400);
  const { data: afterRows } = await base().gt("match_date", to).order("kickoff", { ascending: true }).limit(400);
  return { before: pick(beforeRows || []).slice(0, perSide).reverse(), after: pick(afterRows || []).slice(0, perSide) };
}

/**
 * Lê e valida os parâmetros da rota /api/trip/candidates.
 * Devolve { error } ou { labels, start, end, flex, padDays, from, to }.
 */
export function parseCandidateParams(searchParams, today = todayInSaoPaulo()) {
  const labels = (searchParams.get("countries") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (labels.length === 0) return { error: "Escolha pelo menos um país." };
  const invalid = labels.filter((l) => !WIZARD_COUNTRIES[l]);
  if (invalid.length) return { error: `País inválido: ${invalid.join(", ")}.` };

  const start = searchParams.get("start");
  const end = searchParams.get("end") || start;
  const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
  if (!okDate(start) || !okDate(end)) return { error: "Datas inválidas. Use o formato AAAA-MM-DD." };
  if (end < start) return { error: "A data final não pode ser antes da inicial." };
  if (start < addDays(today, -1)) return { error: "Escolha datas a partir de hoje." };
  if (end > addDays(today, 365)) return { error: "Só dá pra montar viagens dos próximos 12 meses." };
  if (new Date(`${end}T12:00:00Z`) - new Date(`${start}T12:00:00Z`) > 120 * 86400000) return { error: "O período da viagem pode ter no máximo 120 dias." };

  const flex = FLEX_PAD_DAYS[searchParams.get("flex")] !== undefined ? searchParams.get("flex") : "fixed";
  const padDays = FLEX_PAD_DAYS[flex];
  const from = addDays(start, -padDays) < today ? today : addDays(start, -padDays);
  const to = addDays(end, padDays);
  return { labels, start, end, flex, padDays, from, to };
}
