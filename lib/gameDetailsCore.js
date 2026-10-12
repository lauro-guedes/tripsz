/**
 * Detalhes de um jogo (escalação, gols, estatísticas) — funções PURAS.
 *
 * Rodam no servidor (montam o resumo a partir do que a API-Football devolve,
 * em `lib/gameDetails.js`) e no navegador (o modal "Detalhes da experiência"
 * transforma esse resumo em linha do tempo, barras de estatística, campo...).
 * Nada aqui fala com a rede nem com o banco, então dá pra testar tudo.
 */
import { teamLabel } from "./textUtils";

export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

/** Texto pequeno embaixo do placar. */
export function statusLabel(short) {
  const map = { AET: "PRORROGAÇÃO", PEN: "PÊNALTIS", PST: "ADIADO", CANC: "CANCELADO", ABD: "ABANDONADO", AWD: "W.O.", WO: "W.O." };
  return map[short] || "ENCERRADO";
}

/* ---------- nomes e formatos ---------- */

/**
 * Nome curto pro campo e pra listas ("B. Saka" -> "Saka", "V. van Dijk" ->
 * "van Dijk", "Gabriel Jesus" -> "Jesus"). A API manda o nome do jeito dela.
 */
export function shortName(name) {
  if (!name || typeof name !== "string") return "";
  const n = name.trim();
  const dot = n.indexOf(". ");
  if (dot > 0 && dot <= 3) return n.slice(dot + 2).trim(); // "B. Saka"
  const parts = n.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : n;
}

/** 18 -> "18′" · 90 + 4 -> "90+4′" */
export function formatMinute(minute, extra) {
  const m = Number(minute) || 0;
  return `${m}${extra ? `+${extra}` : ""}′`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2025-10-14" -> "14 out 2025" */
export function formatShortDate(value) {
  const s = typeof value === "string" ? value.slice(0, 10) : "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return "";
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Horário do jogo em Brasília (o app inteiro trabalha em horário de Brasília). */
export function formatTimeBrasilia(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function formatInt(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

/** Visitas da pessoa a um estádio (mesma regra de "estádio diferente" do XP: o nome guardado). */
export function stadiumVisits(games, game) {
  if (!game || !game.stadium) return { count: 0, first: null };
  const same = (games || []).filter((x) => x.stadium === game.stadium);
  const first = same.map((x) => String(x.match_date || "").slice(0, 10)).filter(Boolean).sort()[0] || null;
  return { count: same.length, first };
}

/* ---------- montagem do resumo (servidor) ---------- */

const num = (v) => {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace("%", ""));
  return Number.isFinite(n) ? n : 0;
};

const STAT_TYPES = {
  possession: "Ball Possession",
  shots: "Total Shots",
  onTarget: "Shots on Goal",
  corners: "Corner Kicks",
  fouls: "Fouls",
  yellow: "Yellow Cards",
  red: "Red Cards",
  passes: "Total passes",
};

function shapeLineup(l, captainIds) {
  const player = (x) => (x && x.player) || x || {};
  return {
    formation: l.formation || null,
    coach: (l.coach && l.coach.name) || null,
    startXI: (l.startXI || []).map((x) => {
      const p = player(x);
      return { id: p.id ?? null, name: p.name || "", number: p.number ?? null, pos: p.pos || null, grid: p.grid || null, captain: captainIds.has(p.id) };
    }),
    substitutes: (l.substitutes || []).map((x) => {
      const p = player(x);
      return { id: p.id ?? null, name: p.name || "", number: p.number ?? null, pos: p.pos || null };
    }),
  };
}

function shapeStats(entries, home, away) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const hEntry = entries.find((e) => e.team && e.team.id === home.id);
  const aEntry = entries.find((e) => e.team && e.team.id === away.id);
  if (!hEntry || !aEntry) return null;
  const read = (entry) => {
    const byType = new Map((entry.statistics || []).map((s) => [s.type, s.value]));
    const out = {};
    for (const [key, type] of Object.entries(STAT_TYPES)) out[key] = num(byType.get(type));
    return out;
  };
  const h = read(hEntry);
  const a = read(aEntry);
  // Tudo zerado = a API não tem estatística desse jogo (não é "0 finalizações").
  const any = [...Object.values(h), ...Object.values(a)].some((v) => v > 0);
  return any ? { home: h, away: a } : null;
}

/**
 * Do jogo como a API-Football devolve (`/fixtures?id=`) para o resumo que o
 * navegador usa. `venue` e `roundLabel` vêm de fora (o servidor resolve).
 */
export function shapeFixtureDetails(fx, { venue = null, roundLabel = null } = {}) {
  const f = (fx && fx.fixture) || {};
  const lg = (fx && fx.league) || {};
  const tm = (fx && fx.teams) || {};
  const gl = (fx && fx.goals) || {};
  const sc = (fx && fx.score) || {};
  const home = tm.home || {};
  const away = tm.away || {};

  const captainIds = new Set();
  for (const t of (fx && fx.players) || []) {
    for (const p of t.players || []) if (p.statistics && p.statistics[0] && p.statistics[0].games && p.statistics[0].games.captain) captainIds.add(p.player && p.player.id);
  }

  const rawLineups = (fx && fx.lineups) || [];
  const lh = rawLineups.find((l) => l.team && l.team.id === home.id);
  const la = rawLineups.find((l) => l.team && l.team.id === away.id);
  let lineups = null;
  if (lh && la) {
    const h = shapeLineup(lh, captainIds);
    const a = shapeLineup(la, captainIds);
    if (h.startXI.length > 0 && a.startXI.length > 0) lineups = { home: h, away: a };
  }

  // Quem é de qual time (pra decidir gol contra e quem entra/sai numa substituição).
  const sideByPlayer = new Map();
  const benchIds = new Set();
  if (lineups) {
    for (const side of ["home", "away"]) {
      lineups[side].startXI.forEach((p) => p.id != null && sideByPlayer.set(p.id, side));
      lineups[side].substitutes.forEach((p) => {
        if (p.id != null) {
          sideByPlayer.set(p.id, side);
          benchIds.add(p.id);
        }
      });
    }
  }
  const sideOfTeam = (team) => (team && team.id != null && team.id === home.id ? "home" : team && team.id != null && team.id === away.id ? "away" : null);

  const events = [];
  for (const e of (fx && fx.events) || []) {
    const detail = e.detail || "";
    const comments = e.comments || "";
    if (/shootout/i.test(comments)) continue; // pênaltis da disputa não são gols do jogo
    let kind = null;
    if (e.type === "Goal") kind = /own goal/i.test(detail) ? "own-goal" : /missed penalty/i.test(detail) ? "missed-penalty" : /penalty/i.test(detail) ? "penalty" : "goal";
    else if (e.type === "Card") kind = /red|second yellow/i.test(detail) ? "red" : "yellow";
    else if (e.type === "subst") kind = "sub";
    else if (e.type === "Var") kind = "var";
    if (!kind) continue;

    const item = {
      minute: (e.time && e.time.elapsed) ?? 0,
      extra: (e.time && e.time.extra) ?? null,
      side: sideOfTeam(e.team),
      kind,
      detail,
      player: (e.player && e.player.name) || null,
      assist: (e.assist && e.assist.name) || null,
    };
    if (kind === "own-goal") item.ownerSide = (e.player && sideByPlayer.get(e.player.id)) || null;
    if (kind === "sub") {
      // A API manda "player" e "assist"; qual é quem entra? Quem está no banco entrou.
      let out = e.player || {};
      let inn = e.assist || {};
      if (out.id != null && benchIds.has(out.id) && !(inn.id != null && benchIds.has(inn.id))) [out, inn] = [inn, out];
      item.playerOut = out.name || null;
      item.playerIn = inn.name || null;
    }
    events.push(item);
  }

  const penalty = sc.penalty && sc.penalty.home != null && sc.penalty.away != null ? { home: sc.penalty.home, away: sc.penalty.away } : null;

  return {
    fixtureId: f.id ?? null,
    status: { short: (f.status && f.status.short) || null, elapsed: (f.status && f.status.elapsed) ?? null, extra: (f.status && f.status.extra) ?? null },
    kickoff: f.date || null,
    referee: f.referee || null,
    league: { name: lg.name || null, round: lg.round || null, roundLabel, season: lg.season ?? null },
    teams: {
      home: { id: home.id ?? null, name: home.name || "", logo: home.logo || null },
      away: { id: away.id ?? null, name: away.name || "", logo: away.logo || null },
    },
    goals: { home: gl.home ?? null, away: gl.away ?? null },
    penalty,
    venue,
    events,
    lineups,
    stats: shapeStats((fx && fx.statistics) || [], home, away),
  };
}

/* ---------- linha do tempo (gols e acontecimentos) ---------- */

const VAR_TEXT = {
  "goal cancelled": "Gol anulado",
  "goal confirmed": "Gol confirmado",
  "penalty confirmed": "Pênalti confirmado",
  "penalty cancelled": "Pênalti anulado",
  "card upgrade": "Cartão revisto",
  "red card cancelled": "Cartão vermelho anulado",
};

const GOAL_KINDS = new Set(["goal", "penalty", "own-goal"]);
const opposite = (s) => (s === "home" ? "away" : s === "away" ? "home" : null);

/** Qual time FICA com o gol — o gol contra conta pro adversário de quem fez. */
function beneficiaries(events, finalGoals) {
  const withVariant = (variant) =>
    events.map((e) => {
      if (!GOAL_KINDS.has(e.kind)) return null;
      if (e.kind !== "own-goal") return e.side;
      if (e.ownerSide) return opposite(e.ownerSide); // sabemos de qual time o jogador é: definitivo
      return variant === "A" ? opposite(e.side) : e.side;
    });
  const totals = (list) => list.reduce((acc, s) => (s ? { ...acc, [s]: acc[s] + 1 } : acc), { home: 0, away: 0 });
  const hasFinal = finalGoals && finalGoals.home != null && finalGoals.away != null;
  const matches = (t) => !hasFinal || (t.home === finalGoals.home && t.away === finalGoals.away);
  const a = withVariant("A");
  const b = withVariant("B");
  const ta = totals(a);
  const tb = totals(b);
  const useB = !matches(ta) && matches(tb);
  const chosen = useB ? b : a;
  const t = useB ? tb : ta;
  return { list: chosen, totals: t, consistent: matches(t) };
}

/**
 * Linha do tempo pronta pra tela. Cada item: { key, minute, extra, kind, side,
 * isGoal, title, label, subtitle, scoreAfter }.
 */
export function buildTimeline(d) {
  const homeName = teamLabel(d.teams.home.name);
  const awayName = teamLabel(d.teams.away.name);
  const nameOf = (s) => (s === "home" ? homeName : s === "away" ? awayName : "");
  const events = d.events || [];
  const ben = beneficiaries(events, d.goals);
  let running = { home: 0, away: 0 };
  const items = [];

  events.forEach((e, i) => {
    const key = `${i}-${e.kind}-${e.minute}`;
    const base = { key, minute: e.minute, extra: e.extra, kind: e.kind, side: e.side, isGoal: GOAL_KINDS.has(e.kind), label: null, scoreAfter: null };
    const team = nameOf(e.side);
    if (GOAL_KINDS.has(e.kind)) {
      const to = ben.list[i];
      if (to) running = { ...running, [to]: running[to] + 1 };
      const scoreAfter = ben.consistent ? `${running.home}–${running.away}` : null;
      if (e.kind === "own-goal") {
        const owner = e.ownerSide || opposite(to) || e.side;
        items.push({ ...base, side: to || e.side, title: e.player || "Gol contra", label: "GOL CONTRA", scoreAfter, beneficiary: to, subtitle: [nameOf(owner), to ? `A favor do ${nameOf(to)}` : null, "Sem assistência"].filter(Boolean).join(" · ") });
      } else if (e.kind === "penalty") {
        items.push({ ...base, title: e.player || "Pênalti", label: "PÊNALTI", scoreAfter, beneficiary: to, subtitle: [team, e.assist ? `Assistência: ${e.assist}` : "Sem assistência"].filter(Boolean).join(" · ") });
      } else {
        items.push({ ...base, title: e.player || "Gol", label: "GOL", scoreAfter, beneficiary: to, subtitle: [team, e.assist ? `Assistência: ${e.assist}` : "Sem assistência"].filter(Boolean).join(" · ") });
      }
    } else if (e.kind === "missed-penalty") {
      items.push({ ...base, title: e.player || "Pênalti perdido", subtitle: [team, "Pênalti perdido"].filter(Boolean).join(" · ") });
    } else if (e.kind === "yellow" || e.kind === "red") {
      items.push({ ...base, title: e.player || "Cartão", subtitle: [team, e.kind === "red" ? "Cartão vermelho" : "Cartão amarelo"].filter(Boolean).join(" · ") });
    } else if (e.kind === "sub") {
      const title = e.playerIn && e.playerOut ? `Entra ${shortName(e.playerIn)} · sai ${shortName(e.playerOut)}` : e.playerIn ? `Entra ${shortName(e.playerIn)}` : "Substituição";
      items.push({ ...base, title, subtitle: [team, "Substituição"].filter(Boolean).join(" · ") });
    } else if (e.kind === "var") {
      const text = VAR_TEXT[String(e.detail || "").toLowerCase()] || e.detail || "Revisão";
      items.push({ ...base, title: "VAR", subtitle: [team, text].filter(Boolean).join(" · ") });
    }
  });

  const lastMinute = events.length ? Math.max(...events.map((e) => e.minute || 0)) : 90;
  const elapsed = d.status && d.status.elapsed ? d.status.elapsed : Math.max(90, lastMinute);
  const endLabel = formatMinute(elapsed, d.status && d.status.extra);

  const finalHome = d.goals.home != null ? d.goals.home : ben.totals.home;
  const finalAway = d.goals.away != null ? d.goals.away : ben.totals.away;

  const goals = items
    .filter((it) => it.isGoal)
    .map((it) => ({
      key: it.key,
      minute: formatMinute(it.minute, it.extra),
      text: `${shortName(it.title)} · ${it.kind === "penalty" ? "Pênalti" : it.kind === "own-goal" ? "Gol contra" : nameOf(it.side)}`,
      kind: it.kind,
      surname: shortName(it.title),
      beneficiary: it.beneficiary ? nameOf(it.beneficiary) : null,
    }));

  return { items, goals, endLabel, finalScore: { home: finalHome, away: finalAway }, homeName, awayName };
}

/** "O jogo em 3 gols" / "O jogo em 1 gol" / "O jogo sem gols". */
export function goalsHeadline(count) {
  if (!count) return "O jogo sem gols";
  return `O jogo em ${count} ${count === 1 ? "gol" : "gols"}`;
}

/* ---------- estatísticas ---------- */

/** Linhas do comparativo. Cartões = amarelos + vermelhos. */
export function statRows(d) {
  if (!d || !d.stats) return [];
  const h = d.stats.home;
  const a = d.stats.away;
  return [
    { key: "possession", label: "Posse de bola", home: h.possession, away: a.possession, suffix: "%" },
    { key: "shots", label: "Finalizações", home: h.shots, away: a.shots, suffix: "" },
    { key: "onTarget", label: "No alvo", home: h.onTarget, away: a.onTarget, suffix: "" },
    { key: "corners", label: "Escanteios", home: h.corners, away: a.corners, suffix: "" },
    { key: "fouls", label: "Faltas", home: h.fouls, away: a.fouls, suffix: "" },
    { key: "cards", label: "Cartões", home: h.yellow + h.red, away: a.yellow + a.red, suffix: "" },
    { key: "passes", label: "Passes", home: h.passes, away: a.passes, suffix: "" },
  ];
}

/** "Cartões: nenhum do Arsenal e 1 amarelo do Chelsea. Nenhum vermelho." */
export function cardsNote(d) {
  if (!d || !d.stats) return "";
  const home = teamLabel(d.teams.home.name);
  const away = teamLabel(d.teams.away.name);
  const part = (name, y, r) => {
    if (!y && !r) return `nenhum do ${name}`;
    const bits = [];
    if (y) bits.push(`${y} ${y === 1 ? "amarelo" : "amarelos"}`);
    if (r) bits.push(`${r} ${r === 1 ? "vermelho" : "vermelhos"}`);
    return `${bits.join(" e ")} do ${name}`;
  };
  const h = d.stats.home;
  const a = d.stats.away;
  const reds = h.red + a.red;
  return `Cartões: ${part(home, h.yellow, h.red)} e ${part(away, a.yellow, a.red)}.${reds === 0 ? " Nenhum vermelho." : ""}`;
}

/* ---------- escalação (campo) ---------- */

/**
 * Titulares em linhas, do ATAQUE (topo do campo) pro GOLEIRO (embaixo).
 * Usa o "grid" da API ("linha:coluna", linha 1 = goleiro). A coluna 1 da API é
 * o lado DIREITO do time, então invertemos pra lateral-direito aparecer à
 * direita de quem olha o campo. Sem grid (jogos antigos), agrupa por posição.
 */
export function layoutLineup(lineup) {
  const xi = (lineup && lineup.startXI) || [];
  if (xi.length === 0) return [];
  const hasGrid = xi.every((p) => /^\d+:\d+$/.test(p.grid || ""));
  let rows;
  if (hasGrid) {
    const byRow = new Map();
    for (const p of xi) {
      const [r, c] = p.grid.split(":").map(Number);
      if (!byRow.has(r)) byRow.set(r, []);
      byRow.get(r).push({ ...p, col: c });
    }
    rows = [...byRow.keys()].sort((a, b) => a - b).map((r) => byRow.get(r).sort((a, b) => b.col - a.col));
  } else if (xi.every((p) => ["G", "D", "M", "F"].includes(p.pos))) {
    rows = ["G", "D", "M", "F"].map((pos) => xi.filter((p) => p.pos === pos)).filter((r) => r.length > 0);
  } else {
    // Sem grid e sem posições (acontece em jogos de copa): a API lista os titulares na ordem
    // goleiro → defesa → meio → ataque, então fatia essa ordem pela formação ("4-2-3-1").
    // Sem formação válida, usa 4-3-3 — melhor que empilhar os 11 numa linha só.
    const parts = String(lineup.formation || "").split("-").map(Number);
    const valid = parts.length >= 2 && parts.every((n) => Number.isInteger(n) && n > 0) && parts.reduce((a, b) => a + b, 0) === xi.length - 1;
    const shape = xi.length === 11 ? [1, ...(valid ? parts : [4, 3, 3])] : [xi.length];
    rows = [];
    let at = 0;
    for (const size of shape) {
      rows.push(xi.slice(at, at + size));
      at += size;
    }
  }
  return rows.reverse();
}

/** Distância do topo (px) de cada linha de jogadores num campo de 310 px: ataque 30 ... goleiro 246. */
export function pitchRowTops(rowCount) {
  if (rowCount <= 1) return [138];
  const step = (246 - 30) / (rowCount - 1);
  return Array.from({ length: rowCount }, (_, i) => 30 + i * step);
}

/** Nome no campo: sobrenome (+ " · C" se for o capitão). */
export function pitchLabel(p) {
  const n = shortName(p.name);
  return p.captain ? `${n} · C` : n;
}

export function hasCaptain(lineups) {
  return !!(lineups && [...lineups.home.startXI, ...lineups.away.startXI].some((p) => p.captain));
}

/** Emoji de bandeira a partir do código do país (ISO de 2 letras). */
export function flagEmoji(cc) {
  if (!cc || cc.length !== 2) return "";
  const base = 0x1f1e6;
  const up = cc.toUpperCase();
  return String.fromCodePoint(base + up.charCodeAt(0) - 65, base + up.charCodeAt(1) - 65);
}
