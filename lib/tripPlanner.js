/**
 * Motor do Montar Viagem — lógica PURA (sem rede, sem banco). Recebe as
 * respostas do questionário e os jogos REAIS candidatos (de
 * lib/fixturesCalendar.js) e devolve o roteiro.
 *
 * Princípios:
 *  - Só jogos reais. Nada de nota de "atmosfera" nem preço inventado.
 *  - Respeita o que a pessoa escolheu. Quando algo não dá certo (sem jogo nas
 *    datas, sem competição internacional, time favorito que não joga), NÃO
 *    troca por outra coisa em silêncio: avisa e mostra os jogos reais mais
 *    próximos, marcados como fora das datas.
 *  - Roteiro viável: o ritmo é o número de dias livres entre jogos, e a
 *    distância entre as cidades decide quantos dias a viagem exige.
 */
import { haversineKm } from "./citiesCore";
import { FLEX_PAD_DAYS, addDays } from "./calendarCore";
import { RIVALRIES } from "./data/rivalries";
import { TEAM_LOGO_IDS } from "./teamLogoIds";

import { PACE_FREE_DAYS } from "./paceRules";
export { PACE_FREE_DAYS };
export const PRIORITIES = ["maxgames", "stadiums", "classics", "international"];
export const MAX_GAMES = 10; // limite de segurança: não vira maratona impossível

const FAVORITE_WEIGHT = 100; // jogo de time favorito pesa mais que qualquer prioridade de estilo
const RIVALRY_BONUS = 10;
const APPROX_PENALTY = 0.2; // prefere local exato a "local provável" quando o resto empata
const DISTANCE_PENALTY = 0.00004; // por km — só DESEMPATA (10.000 km custam 0,4, menos que qualquer jogo vale): entre roteiros iguais, fica com o de menos deslocamento
const PER_DAY_POOL = 3; // por dia, só os 3 melhores jogos entram na conta (só um pode ser escolhido)

/* ---------- utilidades ---------- */

export function teamKey(name) {
  return (name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function dayNumber(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
export function dateFromDay(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}
const fmtDay = (dateStr) => `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;
const distanceKm = (a, b) => haversineKm(a.lat, a.lon, b.lat, b.lon);

/* ---------- clássicos ---------- */

const RIVALRY_INDEX = RIVALRIES.map((r) => ({ a: new Set(r.a.map(teamKey)), b: new Set(r.b.map(teamKey)), name: r.name }));
/** Nome do clássico entre dois times (pelo nome na API), ou null. */
export function rivalryOf(homeName, awayName) {
  const h = teamKey(homeName);
  const w = teamKey(awayName);
  for (const r of RIVALRY_INDEX) {
    if ((r.a.has(h) && r.b.has(w)) || (r.b.has(h) && r.a.has(w))) return r.name;
  }
  return null;
}

/* ---------- janela de datas ---------- */

/**
 * Datas da viagem + folga. dateStart/dateEnd vêm do questionário;
 * flexLevel: fixed = 0, some = ±7, flex = ±21 dias.
 */
export function resolveWindow({ dateStart, dateEnd, flexLevel }, today) {
  const start = dateStart || today;
  const end = dateEnd || addDays(start, 30);
  const flex = FLEX_PAD_DAYS[flexLevel] !== undefined ? flexLevel : "fixed";
  const padDays = FLEX_PAD_DAYS[flex];
  const rawFrom = addDays(start, -padDays);
  const from = rawFrom < today ? today : rawFrom;
  const to = addDays(end, padDays);
  return { start, end, flex, padDays, from, to, durationDays: Math.max(0, dayNumber(end) - dayNumber(start)) };
}

/* ---------- deslocamento e ritmo ---------- */

/** Dias de calendário que a viagem exige entre dois jogos, pela distância (regra prática). */
export function travelMinDays(km) {
  if (km <= 400) return 1; // trem ou carro: dá pra ir de um dia pro outro
  if (km <= 1500) return 2; // voo curto
  if (km <= 5000) return 3; // voo longo
  return 4; // intercontinental
}
/** Diferença mínima de dias entre dois jogos seguidos: o maior entre o ritmo escolhido e o deslocamento. */
export function requiredGap(a, b, paceFree) {
  return Math.max(paceFree + 1, travelMinDays(distanceKm(a, b)));
}

/* ---------- escolha dos jogos ---------- */

function weightOf(game, priority) {
  let w = 1;
  if (game.favorite) w += FAVORITE_WEIGHT;
  if (priority === "classics" && game.rivalry) w += RIVALRY_BONUS;
  if (game.approxLocation) w -= APPROX_PENALTY;
  return w;
}

/**
 * Melhor sequência de jogos (programação dinâmica): maximiza o peso total,
 * respeitando o intervalo mínimo entre jogos seguidos e o limite de jogos.
 * `pool` precisa estar em ordem de horário.
 */
function bestChain(pool, priority, paceFree, maxGames) {
  const n = pool.length;
  if (n === 0) return { score: 0, chain: [] };
  const day = pool.map((g) => dayNumber(g.matchDate));
  const w = pool.map((g) => weightOf(g, priority));
  const K = Math.min(maxGames, n);
  const NEG = -Infinity;
  const dp = Array.from({ length: K + 1 }, () => new Array(n).fill(NEG));
  const par = Array.from({ length: K + 1 }, () => new Array(n).fill(-1));
  for (let i = 0; i < n; i++) dp[1][i] = w[i];
  for (let k = 2; k <= K; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        if (dp[k - 1][j] === NEG) continue;
        if (day[i] - day[j] < requiredGap(pool[j], pool[i], paceFree)) continue;
        const v = dp[k - 1][j] + w[i] - DISTANCE_PENALTY * distanceKm(pool[j], pool[i]);
        if (v > dp[k][i]) {
          dp[k][i] = v;
          par[k][i] = j;
        }
      }
    }
  }
  let best = { score: NEG, k: 0, i: -1 };
  for (let k = 1; k <= K; k++) for (let i = 0; i < n; i++) if (dp[k][i] > best.score) best = { score: dp[k][i], k, i };
  const chain = [];
  for (let k = best.k, i = best.i; k >= 1 && i >= 0; i = par[k][i], k--) chain.unshift(pool[i]);
  return { score: best.score, chain };
}

const stadiumKey = (g) => `${norm(g.venue.name || g.venue.city)}|${g.cc || ""}`;

/** "Mais estádios": dentro da janela, só o melhor jogo de cada estádio. */
function dedupeByStadium(pool, priority) {
  const best = new Map();
  for (const g of pool) {
    const k = stadiumKey(g);
    const cur = best.get(k);
    if (!cur || weightOf(g, priority) > weightOf(cur, priority)) best.set(k, g);
  }
  return pool.filter((g) => best.get(stadiumKey(g)) === g);
}

/** Por dia só o mínimo necessário (um dia só comporta um jogo): mantém a conta rápida mesmo com milhares de jogos. */
function prunePerDay(pool, priority) {
  const byDay = new Map();
  for (const g of pool) {
    if (!byDay.has(g.matchDate)) byDay.set(g.matchDate, []);
    byDay.get(g.matchDate).push(g);
  }
  const keep = new Set();
  for (const list of byDay.values()) {
    [...list].sort((a, b) => weightOf(b, priority) - weightOf(a, priority)).slice(0, PER_DAY_POOL).forEach((g) => keep.add(g));
  }
  return pool.filter((g) => keep.has(g));
}

/**
 * Testa cada posição possível da viagem dentro da janela com folga (a viagem
 * dura o que a pessoa escolheu, mas pode deslizar ±7 ou ±21 dias) e fica com a
 * melhor.
 */
function chooseGames(eligible, window, priority, paceFree) {
  if (eligible.length === 0) return { chain: [], windowStart: window.start };
  const sorted = [...eligible].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const fromDay = dayNumber(window.from);
  const lastStartDay = Math.max(fromDay, dayNumber(window.to) - window.durationDays);
  let best = null;
  const seen = new Set();
  for (let s = fromDay; s <= lastStartDay; s++) {
    const endDay = s + window.durationDays;
    const idx = [];
    sorted.forEach((g, i) => {
      const d = dayNumber(g.matchDate);
      if (d >= s && d <= endDay) idx.push(i);
    });
    if (idx.length === 0) continue;
    const key = `${idx[0]}-${idx[idx.length - 1]}-${idx.length}`; // mesma lista de jogos = mesmo resultado
    if (seen.has(key)) continue;
    seen.add(key);
    let pool = idx.map((i) => sorted[i]);
    if (priority === "stadiums") pool = dedupeByStadium(pool, priority);
    pool = prunePerDay(pool, priority);
    const r = bestChain(pool, priority, paceFree, MAX_GAMES);
    if (!best || r.score > best.score + 1e-9 || (Math.abs(r.score - best.score) <= 1e-9 && r.chain.length > best.chain.length)) {
      best = { ...r, windowStart: s };
    }
  }
  if (!best) return { chain: [], windowStart: window.start };
  return { chain: best.chain, windowStart: dateFromDay(best.windowStart), score: best.score };
}

/* ---------- textos ---------- */

/** "Regular Season - 10" -> "Rodada 10", "League Stage - 3" -> "Fase de liga • jogo 3"... */
export function roundLabel(round) {
  if (!round) return null;
  let m = /^Regular Season - (\d+)$/i.exec(round);
  if (m) return `Rodada ${m[1]}`;
  m = /^(?:League Stage|Group Stage)\s*-\s*(\d+)$/i.exec(round);
  if (m) return `Fase de liga • jogo ${m[1]}`;
  m = /^(\d+)(?:st|nd|rd|th) Round$/i.exec(round);
  if (m) return `${m[1]}ª fase`;
  const map = { "Round of 16": "Oitavas de final", "Quarter-finals": "Quartas de final", "Semi-finals": "Semifinal", Final: "Final", "Round of 32": "16 avos de final", "3rd Place Final": "Disputa do 3º lugar" };
  return map[round] || round;
}

function gameLine(g) {
  return [g.competition.name, roundLabel(g.competition.round)].filter(Boolean).join(" • ");
}
const gameName = (g) => `${g.home.name} x ${g.away.name}`;

function explainMiss(game, selected, paceFree, windowInfo) {
  const day = dayNumber(game.matchDate);
  for (const s of selected) {
    const gap = Math.abs(dayNumber(s.matchDate) - day);
    const a = dayNumber(s.matchDate) < day ? s : game;
    const b = a === s ? game : s;
    const need = requiredGap(a, b, paceFree);
    if (gap < need) {
      const km = Math.round(distanceKm(s, game));
      if (gap === 0) return `acontece no mesmo dia de ${gameName(s)}`;
      const sameCity = km < 30;
      return sameCity
        ? `fica a menos de ${gap + 1} dias de ${gameName(s)} (${fmtDay(s.matchDate)}), e o ritmo escolhido pede mais folga`
        : `fica a só ${gap} dia(s) de ${gameName(s)} (${fmtDay(s.matchDate)}), em ${s.venue.city}, a cerca de ${km} km — o deslocamento e o ritmo escolhidos pedem ${need} dias`;
    }
  }
  if (game.matchDate < windowInfo.start || game.matchDate > windowInfo.end) return "fica fora da melhor posição da sua viagem dentro da flexibilidade de datas";
  return `o roteiro já está no limite de ${MAX_GAMES} jogos`;
}

/* ---------- roteiro dia a dia ---------- */

export function buildItinerary(selected) {
  if (selected.length === 0) return [];
  const items = [];
  const first = selected[0];
  items.push({ date: addDays(first.matchDate, -1), type: "arrival", title: `Chegada em ${first.venue.city}`, body: "Explore a cidade e se prepare para o jogo do dia seguinte." });
  selected.forEach((g, i) => {
    const prev = selected[i - 1];
    if (prev && distanceKm(prev, g) >= 30) {
      const km = Math.round(distanceKm(prev, g));
      const travelDate = dayNumber(g.matchDate) - dayNumber(prev.matchDate) >= 2 ? addDays(g.matchDate, -1) : g.matchDate;
      items.push({ date: travelDate, type: "travel", title: `Deslocamento para ${g.venue.city}`, body: `Cerca de ${km} km em linha reta (${km <= 400 ? "trem ou carro" : "voo"}).` });
    }
    const place = [g.venue.name, g.venue.city].filter(Boolean).join(", ");
    items.push({ date: g.matchDate, type: "game", gameId: g.id, title: gameName(g), body: [gameLine(g), place].filter(Boolean).join(" • ") });
  });
  const last = selected[selected.length - 1];
  items.push({ date: addDays(last.matchDate, 1), type: "return", title: "Retorno", body: "Últimas compras e embarque de volta." });
  const base = dayNumber(items[0].date);
  return items.map((it) => ({ ...it, day: `Dia ${dayNumber(it.date) - base + 1}` }));
}

/* ---------- o plano ---------- */

/** Nomes dos times favoritos (como no questionário) -> IDs de time na API. */
export function favoriteMap(names) {
  const map = new Map(); // id -> nome
  for (const name of names || []) if (TEAM_LOGO_IDS[name]) map.set(TEAM_LOGO_IDS[name], name);
  return map;
}

/**
 * @param answers   respostas do questionário (countries, dateStart, dateEnd, flexLevel, favoriteTeams, priority, pace, adults, kids, budget)
 * @param candidates { games, unlocated } — jogos reais dos países pedidos, na janela com folga (lib/fixturesCalendar.getCandidates)
 * @param opts      { today, outside } — outside: jogos reais mais próximos FORA das datas, pra sugerir
 *                  { window: {before, after}, international: {...}, favorites: { [nome]: {before, after} } }
 */
export function planTrip(answers, candidates, { today, outside = {} } = {}) {
  const pace = PACE_FREE_DAYS[answers.pace] !== undefined ? answers.pace : "spaced";
  const paceFree = PACE_FREE_DAYS[pace];
  const priority = PRIORITIES.includes(answers.priority) ? answers.priority : "classics";
  const window = resolveWindow(answers, today);
  const favorites = favoriteMap(answers.favoriteTeams);

  const possible = candidates.games
    .map((g) => {
      const favTeams = [];
      if (favorites.has(g.home.id)) favTeams.push(favorites.get(g.home.id));
      if (favorites.has(g.away.id)) favTeams.push(favorites.get(g.away.id));
      return { ...g, favorite: favTeams.length > 0, favoriteTeams: favTeams, rivalry: rivalryOf(g.home.name, g.away.name), insideDates: g.matchDate >= window.start && g.matchDate <= window.end };
    })
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const eligible = priority === "international" ? possible.filter((g) => g.competition.type === "continental") : possible;
  const { chain, windowStart } = chooseGames(eligible, window, priority, paceFree);
  const selected = chain.map((g) => ({ ...g, selected: true }));
  const selectedIds = new Set(selected.map((g) => g.id));
  const possibleOut = possible.map((g) => ({ ...g, selected: selectedIds.has(g.id) }));
  const chosenWindow = { start: addDays(window.start, 0), from: windowStart, end: addDays(windowStart, window.durationDays) };
  const rangeText = `${fmtDay(window.start)} a ${fmtDay(window.end)}`;
  const flexText = window.padDays ? ` (com ±${window.padDays} dias de folga)` : "";
  const countriesText = (answers.countries || []).join(", ");

  /* avisos: a plataforma diz o que fez e o que NÃO conseguiu */
  const notes = [];
  if (possible.length === 0) {
    notes.push({ type: "no_games_in_window", message: `Não encontramos jogos reais em ${countriesText || "nos países escolhidos"} entre ${rangeText}${flexText}. Veja os mais próximos, fora das suas datas.`, suggestions: outside.window || null });
  } else if (priority === "international" && eligible.length === 0) {
    notes.push({ type: "no_international", message: `Entre ${rangeText}${flexText} não há jogos de competições internacionais (Champions League, Europa League, Libertadores...) nos países escolhidos. Em vez de trocar por outros jogos, mostramos os mais próximos, fora das suas datas.`, suggestions: outside.international || null });
  }
  if (possible.length > 0 && eligible.length > 0 && selected.length === 0) {
    notes.push({ type: "no_viable_route", message: "Existem jogos no período, mas nenhum cabe no roteiro com o ritmo e o deslocamento escolhidos." });
  }

  for (const name of answers.favoriteTeams || []) {
    const id = TEAM_LOGO_IDS[name];
    if (!id) continue;
    const games = possible.filter((g) => g.home.id === id || g.away.id === id);
    if (games.length === 0) {
      notes.push({ type: "favorite_without_games", team: name, message: `O ${name} não joga nos países escolhidos entre ${rangeText}${flexText}.`, suggestions: (outside.favorites && outside.favorites[name]) || null });
    } else if (!games.some((g) => selectedIds.has(g.id))) {
      const g = games[0];
      notes.push({ type: "favorite_not_fit", team: name, gameId: g.id, message: `O jogo do ${name} (${gameName(g)}, ${fmtDay(g.matchDate)}) não entrou no roteiro: ${explainMiss(g, selected, paceFree, chosenWindow)}.` });
    } else {
      for (const g of games) {
        if (!selectedIds.has(g.id)) notes.push({ type: "favorite_not_fit", team: name, gameId: g.id, message: `Outro jogo do ${name} (${gameName(g)}, ${fmtDay(g.matchDate)}) ficou de fora: ${explainMiss(g, selected, paceFree, chosenWindow)}.` });
      }
    }
  }

  const flexUsed = selected.filter((g) => !g.insideDates).length;
  if (flexUsed > 0) notes.push({ type: "flex_used", message: `${flexUsed} jogo(s) do roteiro estão fora das datas que você escolheu, dentro da flexibilidade de ±${window.padDays} dias.` });
  const approx = selected.filter((g) => g.approxLocation).length;
  if (approx > 0) notes.push({ type: "approx_location", message: `${approx} jogo(s) do roteiro têm local provável (estádio do time da casa ou cidade vizinha): confirme o estádio antes de ir.` });
  if (candidates.unlocated > 0) notes.push({ type: "unlocated", message: `${candidates.unlocated} jogo(s) desse período ficaram de fora porque ainda não sabemos onde acontecem.` });
  if (selected.length >= MAX_GAMES) notes.push({ type: "cap", message: `Limitamos o roteiro a ${MAX_GAMES} jogos.` });

  const itinerary = buildItinerary(selected);
  const cities = [...new Set(selected.map((g) => g.venue.city))];
  const stadiums = [...new Set(selected.map((g) => g.venue.name || g.venue.city))];
  const countries = [...new Set(selected.map((g) => g.country))];
  const dates = selected.map((g) => g.matchDate).sort();
  const days = answers.dateStart && answers.dateEnd ? Math.max(3, window.durationDays) : dates.length ? Math.max(5, dayNumber(dates[dates.length - 1]) - dayNumber(dates[0]) + 4) : 0;

  return {
    window,
    priority,
    pace: { key: pace, freeDays: paceFree },
    favorites: [...favorites].map(([id, name]) => ({ id, name })),
    possibleCount: possible.length,
    eligibleCount: eligible.length,
    possible: possibleOut,
    selected,
    itinerary,
    notes,
    stats: { games: selected.length, cities: cities.length, stadiums: stadiums.length, countries: countries.length, days, firstDate: dates[0] || null, lastDate: dates[dates.length - 1] || null },
    cities,
    stadiums,
    countries,
  };
}
