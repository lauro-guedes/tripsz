/**
 * Opções de roteiro (A, B, C) — lógica PURA, roda no navegador e no servidor.
 *
 * Parte dos jogos que o motor (lib/tripPlanner.js) já escolheu (`plan.selected`)
 * e monta até três formas de viajar. Nada aqui inventa jogo, preço ou passeio:
 * só reorganiza dias entre os jogos reais.
 *
 *  A — "Foco nos jogos": todos os jogos, só os dias necessários (recomendada).
 *  B — "Jogos + Cultura": os mesmos jogos com 1 dia livre antes e 1 depois (mais relaxada).
 *  C — "Alternativa": fica numa cidade só, sem deslocamento (só aparece se o roteiro
 *      original passa por 2 ou mais cidades). Lista o que ficou de fora.
 */
import { haversineKm } from "./citiesCore";

export const OPTION_KEYS = ["A", "B", "C"];

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
function buildDayPlan(games, { extraBefore = 0, extraAfter = 0 } = {}) {
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

/** Cidade-base da opção C: a que tem mais jogos (empate: a de jogo de time favorito; depois a primeira). */
function pickBaseCity(games) {
  const tally = new Map();
  for (const g of games) {
    const c = cityOf(g);
    const t = tally.get(c) || { n: 0, fav: 0, order: tally.size };
    t.n += 1;
    if (g.favorite) t.fav += 1;
    tally.set(c, t);
  }
  return [...tally.entries()].sort((a, b) => b[1].n - a[1].n || b[1].fav - a[1].fav || a[1].order - b[1].order)[0][0];
}

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
  const out = [];

  // A — foco nos jogos
  const itemsA = buildDayPlan(games);
  const daysA = totalDays(itemsA);
  out.push({
    key: "A",
    title: "Foco nos jogos",
    badge: "Recomendada",
    tone: "green",
    summary: summaryLine(daysA, games, cities, "Recomendada"),
    description:
      games.length === 1
        ? `Roteiro direto para ver ${gameTitle(games[0])} em ${cityOf(games[0])}, com os dias necessários para chegar, assistir e voltar.`
        : `Roteiro direto, na ordem dos jogos${cities.length > 1 ? `: ${cities.join(" → ")}` : ""}. Só os dias necessários para chegar, assistir e se deslocar.`,
    days: daysA,
    gamesCount: games.length,
    cities,
    gameIds: games.map((g) => g.id),
    items: itemsA,
    omitted: [],
  });

  // B — jogos + cultura (um dia livre antes e outro depois)
  const itemsB = buildDayPlan(games, { extraBefore: 1, extraAfter: 1 });
  const daysB = totalDays(itemsB);
  out.push({
    key: "B",
    title: "Jogos + Cultura",
    badge: "Mais relaxada",
    tone: "navy",
    summary: summaryLine(daysB, games, cities, "Ritmo tranquilo"),
    description: `${games.length === 1 ? "O mesmo jogo" : `Os mesmos ${games.length} jogos`} com mais fôlego: um dia livre antes da primeira partida e outro antes de voltar, para conhecer ${cities.length > 1 ? "as cidades" : "a cidade"} com calma.`,
    days: daysB,
    gamesCount: games.length,
    cities,
    gameIds: games.map((g) => g.id),
    items: itemsB,
    omitted: [],
  });

  // C — sem deslocamento entre cidades (só quando o roteiro passa por 2+ cidades)
  if (cities.length >= 2) {
    const base = pickBaseCity(games);
    const gamesC = games.filter((g) => cityOf(g) === base);
    const omitted = games.filter((g) => cityOf(g) !== base).map((g) => ({ id: g.id, name: gameTitle(g) }));
    const itemsC = buildDayPlan(gamesC, { extraBefore: 0, extraAfter: 1 });
    const daysC = totalDays(itemsC);
    const others = cities.filter((c) => c !== base);
    out.push({
      key: "C",
      title: gamesC.length === 1 ? "Um jogo + cultura" : `Foco em ${base}`,
      badge: "Alternativa",
      tone: "slate",
      summary: summaryLine(daysC, gamesC, [base], null),
      description:
        gamesC.length === 1
          ? `Um jogo em ${base} e mais tempo para explorar a cidade, sem deslocamento para ${others.join(" e ")}.`
          : `${gamesC.length} jogos em ${base}, sem deslocamento entre cidades e com um dia livre antes de voltar.`,
      days: daysC,
      gamesCount: gamesC.length,
      cities: [base],
      gameIds: gamesC.map((g) => g.id),
      items: itemsC,
      omitted,
      omittedText: `Fora desta opção: ${omitted.slice(0, 3).map((o) => o.name).join("; ")}${omitted.length > 3 ? ` e mais ${omitted.length - 3}` : ""}. Priorize ${base} e evite o deslocamento.`,
    });
  }
  return out;
}

/** "5 a 7 dias" (ou "5 dias" se todas iguais). */
export function durationRange(options) {
  if (!options.length) return "";
  const ds = options.map((o) => o.days);
  const min = Math.min(...ds);
  const max = Math.max(...ds);
  return min === max ? `${min} dias` : `${min} a ${max} dias`;
}
