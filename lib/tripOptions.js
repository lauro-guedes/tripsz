/**
 * Opções de roteiro (A e B) — lógica PURA, roda no navegador e no servidor.
 *
 *  A — "Monte do seu jeito": a própria pessoa marca os jogos que quer entre os possíveis
 *      (components/roteiro/MontarVoce.jsx). Os jogos marcados ficam em plan.custom.games;
 *      sem eles, a opção A existe só como montador (builder: true), ainda sem dia a dia.
 *  B — "Sugerido por nós" (recomendada): os jogos que o motor (lib/tripPlanner.js) escolheu
 *      (`plan.selected`), em rota linear, só com os dias necessários.
 *
 * Nada aqui inventa jogo, preço ou passeio: só reorganiza dias entre os jogos reais.
 */
import { haversineKm } from "./citiesCore";

export const OPTION_KEYS = ["A", "B"];

const DAY_MS = 86400000;
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const dayNumber = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, dd) / DAY_MS);
};
const dateFromDay = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const addDays = (d, n) => dateFromDay(dayNumber(d) + n);

/** "2025-03-18" -> "18 MAR 2025" */
export function formatDateLabel(d) {
  if (!d) return "";
  return `${d.slice(8, 10)} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}

/** Sigla curta da competição pro selo do dia de jogo: "Premier League" -> "PL". */
const KNOWN_ABBR = {
  "premier league": "PL",
  "la liga": "LL",
  "serie a": "SA",
  bundesliga: "BL",
  "ligue 1": "L1",
  "primeira liga": "PL",
  eredivisie: "ERE",
  "uefa champions league": "UCL",
  "uefa europa league": "UEL",
  "conmebol libertadores": "LIB",
  "conmebol sudamericana": "SUL",
  "copa do brasil": "CDB",
};
export function competitionAbbr(name) {
  if (!name) return "";
  const known = KNOWN_ABBR[name.toLowerCase()];
  if (known) return known;
  const letters = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase();
  return letters.slice(0, 3);
}

const distanceKm = (a, b) => {
  // O motor entrega a coordenada no próprio jogo (g.lat / g.lon); venue.lat/lon fica como alternativa.
  const v = haversineKm(a.lat ?? a.venue?.lat, a.lon ?? a.venue?.lon, b.lat ?? b.venue?.lat, b.lon ?? b.venue?.lon);
  return Number.isFinite(v) ? v : null;
};
const cityOf = (g) => g.venue?.city || g.venue?.name || "";
const placeOf = (g) => g.venue?.name || g.venue?.city || "";
const gameTitle = (g) => `${g.home?.name || ""} vs ${g.away?.name || ""}`;

/** Duas partidas em cidades diferentes (precisa de deslocamento)? Sem coordenadas, confia no nome da cidade. */
function needsTravel(a, b) {
  if (cityOf(a) && cityOf(b) && cityOf(a) === cityOf(b)) return false;
  const km = distanceKm(a, b);
  return km === null ? cityOf(a) !== cityOf(b) : km >= 30;
}

/**
 * Dia a dia: de um dia antes do primeiro jogo até um dia depois do último,
 * preenchendo os dias sem jogo com "dia livre" ou "deslocamento".
 * extraBefore / extraAfter somam dias livres no começo e no fim (opção B).
 */
export function buildDayPlan(games, { extraBefore = 0, extraAfter = 0 } = {}) {
  if (games.length === 0) return [];
  const first = games[0];
  const last = games[games.length - 1];
  const arrival = addDays(first.matchDate, -1 - extraBefore);
  const back = addDays(last.matchDate, 1 + extraAfter);

  const fixed = new Map(); // data -> item
  const gameNote = new Map(); // data -> texto de deslocamento no mesmo dia do jogo

  fixed.set(arrival, { type: "arrival", title: `Chegada em ${cityOf(first)}`, body: "Acomode-se e explore a cidade." });
  games.forEach((g, i) => {
    const prev = games[i - 1];
    if (prev && needsTravel(prev, g)) {
      const km = distanceKm(prev, g);
      const how = km === null ? "" : ` Cerca de ${Math.round(km)} km em linha reta (${km <= 400 ? "trem ou carro" : "voo"}).`;
      const gap = dayNumber(g.matchDate) - dayNumber(prev.matchDate);
      if (gap >= 2) {
        fixed.set(addDays(g.matchDate, -1), { type: "travel", title: `Deslocamento ${cityOf(prev)} → ${cityOf(g)}`, body: how.trim() || "Dia de deslocamento entre as cidades." });
      } else {
        gameNote.set(g.matchDate, `Deslocamento de ${cityOf(prev)} no mesmo dia.${how}`);
      }
    }
    fixed.set(g.matchDate, {
      type: "game",
      gameId: g.id,
      title: gameTitle(g),
      league: competitionAbbr(g.competition?.name),
      competition: g.competition?.name || "",
      stadium: placeOf(g),
      dateLabel: formatDateLabel(g.matchDate),
      body: [placeOf(g), formatDateLabel(g.matchDate)].filter(Boolean).join(" · "),
    });
  });
  fixed.set(back, { type: "return", title: "Retorno", body: "Últimas compras e embarque de volta." });

  // dia livre fica na cidade do último jogo já visto (ou do primeiro, antes dele);
  // o dia de deslocamento já é um item próprio, então não cai aqui
  const cityOnDay = (date) => {
    let city = cityOf(first);
    for (const g of games) if (g.matchDate <= date) city = cityOf(g);
    return city;
  };

  const days = [];
  for (let n = dayNumber(arrival); n <= dayNumber(back); n++) {
    const date = dateFromDay(n);
    const it = fixed.get(date);
    if (it) {
      const note = gameNote.get(date);
      days.push({ ...it, date, body: note ? `${it.body} · ${note}` : it.body });
    } else {
      days.push({ type: "free", date, city: cityOnDay(date) });
    }
  }

  const base = dayNumber(arrival);
  // junta dias livres seguidos na mesma cidade ("Londres livre", dias 3–4)
  const merged = [];
  for (const d of days) {
    const prev = merged[merged.length - 1];
    if (d.type === "free" && prev && prev.type === "free" && prev.city === d.city) {
      prev.lastDate = d.date;
      continue;
    }
    merged.push(d.type === "free" ? { ...d, lastDate: d.date } : d);
  }
  return merged.map((d) => {
    const n1 = dayNumber(d.date) - base + 1;
    if (d.type === "free") {
      const n2 = dayNumber(d.lastDate) - base + 1;
      const range = n2 > n1;
      return {
        type: "free",
        date: d.date,
        day: range ? `${n1}–${n2}` : `Dia ${n1}`,
        title: range ? `${d.city} livre` : `Dia livre em ${d.city}`,
        body: "Tempo para conhecer a cidade, a gastronomia e a cultura local.",
      };
    }
    return { ...d, day: `Dia ${n1}` };
  });
}

const totalDays = (items) => (items.length === 0 ? 0 : dayNumber(items[items.length - 1].date) - dayNumber(items[0].date) + 1);
const joinCities = (games) => [...new Set(games.map(cityOf))].filter(Boolean);

function summaryLine(days, games, cities, extra) {
  return [`${days} dias`, `${games.length} ${games.length === 1 ? "jogo" : "jogos"}`, cities.join(" + "), extra].filter(Boolean).join(" · ");
}

/**
 * @param plan  o plano do motor (precisa de plan.selected; o resto é opcional)
 * @returns lista de opções [{ key, title, badge, tone, summary, description, days, gamesCount, cities, gameIds, items, omitted }]
 */
export function buildOptions(plan) {
  const games = [...(plan?.selected || [])].sort((a, b) => (a.matchDate + (a.kickoff || "")).localeCompare(b.matchDate + (b.kickoff || "")));
  if (games.length === 0) return [];
  const cities = joinCities(games);

  // B — o roteiro que sugerimos: os jogos que o motor escolheu, só com os dias necessários
  const itemsB = buildDayPlan(games);
  const daysB = totalDays(itemsB);
  const suggested = {
    key: "B",
    title: "Sugerido por nós",
    badge: "Recomendada",
    tone: "green",
    summary: summaryLine(daysB, games, cities, "Recomendada"),
    description:
      games.length === 1
        ? `Roteiro direto para ver ${gameTitle(games[0])} em ${cityOf(games[0])}, com os dias necessários para chegar, assistir e voltar.`
        : `Roteiro que montamos para você, na ordem dos jogos${cities.length > 1 ? `: ${cities.join(" → ")}` : ""}, sem voltar para lugares já visitados. Só os dias necessários para chegar, assistir e se deslocar.`,
    days: daysB,
    gamesCount: games.length,
    cities,
    gameIds: games.map((g) => g.id),
    items: itemsB,
    omitted: [],
  };

  // A — o roteiro que a própria pessoa montou (ou o montador, enquanto ela não escolheu os jogos)
  const custom = Array.isArray(plan?.custom?.games) ? [...plan.custom.games].sort((a, b) => (a.matchDate + (a.kickoff || "")).localeCompare(b.matchDate + (b.kickoff || ""))) : [];
  let mine;
  if (custom.length > 0) {
    const citiesA = joinCities(custom);
    const itemsA = buildDayPlan(custom);
    const daysA = totalDays(itemsA);
    mine = {
      key: "A",
      title: "Monte do seu jeito",
      badge: "Do seu jeito",
      tone: "purple",
      summary: summaryLine(daysA, custom, citiesA, "Do seu jeito"),
      description: `${custom.length === 1 ? "O jogo" : `Os ${custom.length} jogos`} que você escolheu${citiesA.length > 1 ? `: ${citiesA.join(" → ")}` : ""}, com os dias de chegada, deslocamento e retorno.`,
      days: daysA,
      gamesCount: custom.length,
      cities: citiesA,
      gameIds: custom.map((g) => g.id),
      items: itemsA,
      omitted: [],
      custom: true,
      games: custom,
    };
  } else {
    mine = { key: "A", title: "Monte do seu jeito", badge: "Do seu jeito", tone: "purple", summary: "Marque os jogos que quer ver", description: "", days: 0, gamesCount: 0, cities: [], gameIds: [], items: [], omitted: [], builder: true };
  }
  return [mine, suggested];
}

/** "5 a 7 dias" (ou "5 dias" se todas iguais). */
export function durationRange(options) {
  if (!options.length) return "";
  const ds = options.map((o) => o.days).filter((d) => d > 0);
  if (!ds.length) return "";
  const min = Math.min(...ds);
  const max = Math.max(...ds);
  return min === max ? `${min} dias` : `${min} a ${max} dias`;
}
