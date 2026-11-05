/**
 * Jogos ao vivo (SÓ no servidor): uma consulta à API-Football (/fixtures?live=all) guardada por 30 s e compartilhada por todo mundo,
 * então a cota gasta é a mesma com 1 ou com 10.000 pessoas olhando. Só entram as ligas que o app acompanha (LEAGUE_META).
 */
import { LEAGUE_META } from "./calendarCore";

const URL_LIVE = "https://v3.football.api-sports.io/fixtures?live=all";
const TTL_MS = 30_000;
let cache = null; // { at, games }
let inflight = null;

const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);
/** Texto do relógio: "73'", "Intervalo", "Prorrogação"... */
export function clockLabel(status, elapsed) {
  if (status === "HT") return "Intervalo";
  if (status === "BT") return "Intervalo da prorrogação";
  if (status === "P") return "Pênaltis";
  if (status === "SUSP" || status === "INT") return "Paralisado";
  return elapsed != null ? `${elapsed}'` : "Ao vivo";
}
/** Resposta crua da API -> lista enxuta (só ligas curadas e jogos realmente em andamento). */
export function shapeLive(response) {
  return (response || [])
    .filter((f) => f && f.league && LEAGUE_META[f.league.id] && LIVE.has(f.fixture && f.fixture.status && f.fixture.status.short))
    .map((f) => ({
      id: f.fixture.id,
      league: { id: f.league.id, name: f.league.name, country: f.league.country, logo: f.league.logo || null, flag: f.league.flag || null },
      home: { name: f.teams.home.name, logo: f.teams.home.logo || null },
      away: { name: f.teams.away.name, logo: f.teams.away.logo || null },
      goals: { home: f.goals.home, away: f.goals.away },
      status: f.fixture.status.short,
      clock: clockLabel(f.fixture.status.short, f.fixture.status.elapsed),
    }));
}

async function pull() {
  const res = await fetch(URL_LIVE, { headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY }, cache: "no-store" });
  const data = await res.json();
  if (!res.ok || (data.errors && Object.keys(data.errors).length > 0)) throw new Error("football");
  return shapeLive(data.response);
}

/** { games, at } — do cache de 30 s; se a API falhar, devolve o último resultado bom (marcado como velho). */
export async function liveGames() {
  if (cache && Date.now() - cache.at < TTL_MS) return { games: cache.games, at: cache.at };
  if (!inflight) inflight = pull().then((games) => { cache = { at: Date.now(), games }; return cache; }).finally(() => { inflight = null; });
  try {
    const c = await inflight;
    return { games: c.games, at: c.at };
  } catch (e) {
    if (cache) return { games: cache.games, at: cache.at, stale: true };
    throw e;
  }
}
