/**
 * Reconhece jogos do Futbology na API-Football — SÓ no servidor.
 *
 * Pra cada data, UMA chamada traz todos os jogos encerrados daquele dia no
 * mundo; casamos cada linha com um deles por data + placar + nome (ver
 * lib/futbologyMatch.js). Resultado: mandante, visitante, escudos, estádio,
 * cidade e país já preenchidos, sem a pessoa digitar nada.
 */
import { findCity } from "@/lib/cities";
import { COUNTRY_CODES } from "@/lib/data/geoExtras";
import { TIMEZONE } from "@/lib/gamesSearchCore";
import { matchRow } from "@/lib/futbologyMatch";

const BASE_URL = "https://v3.football.api-sports.io";
const DAY_CACHE_TTL_MS = 10 * 60 * 1000;
const DAY_CACHE_MAX = 24;
const dayCache = new Map(); // date -> { at, fixtures }

export class PlanLimitError extends Error {}

async function fetchDay(date) {
  const hit = dayCache.get(date);
  if (hit && Date.now() - hit.at < DAY_CACHE_TTL_MS) return hit.fixtures;

  const url = new URL(`${BASE_URL}/fixtures`);
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", TIMEZONE);
  url.searchParams.set("status", "FT-AET-PEN"); // só jogos que terminaram: é o que a pessoa foi ver
  const res = await fetch(url.toString(), { headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY }, cache: "no-store" });
  const data = await res.json();
  const errors = data.errors && !Array.isArray(data.errors) ? data.errors : null;
  if (errors && Object.keys(errors).length > 0) {
    if (errors.plan) throw new PlanLimitError(errors.plan);
    throw new Error(`API-Football: ${JSON.stringify(errors)}`);
  }
  if (!res.ok) throw new Error(`API-Football: HTTP ${res.status}`);

  // guarda só o que a gente usa (a resposta crua é enorme)
  const fixtures = (data.response || []).map((f) => ({
    id: f.fixture.id,
    kickoff: f.fixture.date,
    venue: f.fixture.venue?.name || "",
    city: f.fixture.venue?.city || "",
    home: f.teams.home.name,
    away: f.teams.away.name,
    homeLogo: f.teams.home.logo,
    awayLogo: f.teams.away.logo,
    league: f.league.name,
    leagueCountry: f.league.country,
    goalsHome: f.goals.home,
    goalsAway: f.goals.away,
  }));
  if (dayCache.size >= DAY_CACHE_MAX) dayCache.delete(dayCache.keys().next().value);
  dayCache.set(date, { at: Date.now(), fixtures });
  return fixtures;
}

const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const NAME_BY_CC = Object.fromEntries(Object.entries(COUNTRY_CODES).map(([name, cc]) => [cc, titleCase(name)]));

/** País do jogo: o da liga; em torneio internacional ("World"), o da cidade do estádio. */
function countryOf(f) {
  const lc = (f.leagueCountry || "").trim();
  if (lc && !/^(world|europe|south america|north america|asia|africa|oceania)$/i.test(lc)) return lc;
  const city = f.city ? findCity(f.city) : null;
  return city?.cc ? NAME_BY_CC[city.cc] || "" : "";
}

function toResult(rowId, f) {
  return {
    rowId,
    match: {
      apiFixtureId: f.id,
      home: f.home,
      away: f.away,
      homeLogo: f.homeLogo,
      awayLogo: f.awayLogo,
      stadium: f.venue,
      city: f.city,
      country: countryOf(f),
      competition: f.league,
      date: f.kickoff?.slice(0, 10),
    },
  };
}

/**
 * rows: [{ rowId, date: "YYYY-MM-DD", text, homeScore, awayScore }]
 * Devolve [{ rowId, match | null, reason? }].
 */
export async function resolveRows(rows) {
  const out = new Map();
  const byDate = new Map();
  rows.forEach((r) => {
    if (!r.date) return out.set(r.rowId, { rowId: r.rowId, match: null, reason: "sem_data" });
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  });

  const dates = [...byDate.keys()];
  let next = 0;
  const lanes = Array.from({ length: Math.min(3, dates.length) }, async () => {
    while (next < dates.length) {
      const date = dates[next++];
      const pending = byDate.get(date);
      try {
        // 1º o dia da linha; se não achou, o dia anterior e o seguinte (fuso do estádio ≠ Brasília)
        let todo = pending;
        for (const shift of [0, -1, 1]) {
          if (todo.length === 0) break;
          const fixtures = await fetchDay(shift === 0 ? date : addDays(date, shift));
          const still = [];
          for (const r of todo) {
            const m = matchRow(r, fixtures);
            if (m) out.set(r.rowId, toResult(r.rowId, m.fixture));
            else still.push(r);
          }
          todo = still;
        }
        todo.forEach((r) => out.set(r.rowId, { rowId: r.rowId, match: null, reason: "nao_encontrado" }));
      } catch (e) {
        const reason = e instanceof PlanLimitError ? "plano" : "erro";
        if (reason === "erro") console.error("[futbology] falha em", date, e.message);
        pending.forEach((r) => { if (!out.has(r.rowId)) out.set(r.rowId, { rowId: r.rowId, match: null, reason }); });
      }
    }
  });
  await Promise.all(lanes);
  return rows.map((r) => out.get(r.rowId) || { rowId: r.rowId, match: null, reason: "erro" });
}
