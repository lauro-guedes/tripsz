/**
 * Busca de jogos por País, Liga ou Clube — SÓ no servidor.
 *
 * Lê só da tabela fixtures_calendar (o mesmo calendário do Montar Roteiro),
 * então não gasta nenhuma chamada da API-Football. Só cobre as ligas
 * curadas (LEAGUE_META).
 */
import { supabaseAdmin } from "@/lib/supabase";
import { LEAGUE_META, WIZARD_COUNTRIES, labelForRow, isPlayable, addDays } from "@/lib/calendarCore";
import { searchKey } from "@/lib/searchKey";

const PAGE = 1000;
export const MAX_GAMES = 200;
const OPTIONS_TTL_MS = 6 * 3600 * 1000;
let optionsCache = null;

/** Países (em português) e ligas disponíveis, pros seletores das abas. */
export async function browseOptions() {
  if (optionsCache && Date.now() - optionsCache.at < OPTIONS_TTL_MS) return optionsCache.value;
  const supabase = supabaseAdmin();
  const ids = Object.keys(LEAGUE_META).map(Number);
  const rows = await Promise.all(
    ids.map(async (id) => {
      const { data } = await supabase.from("fixtures_calendar").select("league_id, league_name, league_country").eq("league_id", id).limit(1);
      return data?.[0] || null;
    })
  );
  const leagues = rows
    .filter(Boolean)
    .map((r) => ({ id: r.league_id, name: r.league_name, country: r.league_country, type: LEAGUE_META[r.league_id].type }))
    .sort((a, b) => (a.country || "").localeCompare(b.country || "") || a.name.localeCompare(b.name));
  const countries = Object.keys(WIZARD_COUNTRIES).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const value = { countries, leagues };
  optionsCache = { at: Date.now(), value };
  return value;
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
    distanceKm: null,
    status: g.status,
    approxLocation: g.geo_precision !== "city",
  };
}

/** Jogos a partir de `from`, por `days` dias, filtrados por país (rótulo PT), liga (id) ou clube (nome). */
export async function browseGames({ mode, country, leagueId, team, from, days }) {
  const supabase = supabaseAdmin();
  const to = addDays(from, days);
  const rows = [];
  for (let start = 0; ; start += PAGE) {
    let q = supabase.from("fixtures_calendar").select("*").gte("match_date", from).lte("match_date", to).order("kickoff", { ascending: true }).order("fixture_id", { ascending: true });
    if (mode === "liga") q = q.eq("league_id", leagueId);
    const { data, error } = await q.range(start, start + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  const teamKey = mode === "clube" ? searchKey(team) : null;
  const games = [];
  for (const row of rows) {
    if (!isPlayable(row.status)) continue;
    if (mode === "pais" && labelForRow(row) !== country) continue;
    if (mode === "clube" && searchKey(row.home_team) !== teamKey && searchKey(row.away_team) !== teamKey) continue;
    games.push(toGame(row));
  }
  return { games: games.slice(0, MAX_GAMES), total: games.length, truncated: games.length > MAX_GAMES, from, to };
}
