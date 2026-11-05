/**
 * Onde assistir — regras PURAS (sem rede nem banco): quais jogos entram, quanto tempo a informação vale, como limpar o que o
 * Gemini devolve e o que conta como "fonte confiável". Tudo que vem da IA passa por aqui antes de ser guardado.
 */

const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+]/g, "");

/** Nomes de canal que o app aceita (chave sem acento/espaço/pontuação -> nome que aparece). O que não estiver aqui é recusado e fica no registro. */
const ALIASES = {
  globo: "Globo", tvglobo: "Globo", redeglobo: "Globo", sportv: "SporTV", premiere: "Premiere", premierefc: "Premiere",
  getv: "ge tv", globoplay: "Globoplay", primevideo: "Prime Video", amazonprimevideo: "Prime Video", amazonprime: "Prime Video",
  cazetv: "CazéTV", espn: "ESPN", "disney+": "Disney+", disneyplus: "Disney+", max: "Max", hbomax: "Max", tnt: "TNT", tntsports: "TNT",
  space: "Space", "paramount+": "Paramount+", paramountplus: "Paramount+", sbt: "SBT", nsports: "N Sports", band: "Band",
  bandsports: "BandSports", record: "Record", recordtv: "Record", youtube: "YouTube", dazn: "DAZN", appletv: "Apple TV",
  "appletv+": "Apple TV", xsports: "XSports", fox: "Fox Sports", foxsports: "Fox Sports", onefootball: "OneFootball", twitch: "Twitch",
};
const NUMBERED = new Set(["ESPN", "SporTV"]); // "ESPN 4" e "SporTV 2" mantêm o número (muda onde a pessoa acha o canal)

/** Texto curto de observação (ex.: "SP e parte da rede"): sem símbolos estranhos, até 60 caracteres. */
export function cleanNote(v) {
  return String(v == null ? "" : v).replace(/[^\p{L}\p{N} ,.()+\-/ºª&]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** { name, note } com o nome padronizado, ou null se o canal não é um dos que o app conhece. */
export function normalizeChannel(rawName, rawNote = "") {
  let name = String(rawName == null ? "" : rawName).trim();
  if (!name || name.length > 40) return null;
  let note = cleanNote(rawNote);
  const paren = /\(([^)]{1,60})\)\s*$/.exec(name);
  if (paren) { name = name.slice(0, paren.index).trim(); if (!note) note = cleanNote(paren[1]); }
  const m = /^(.*?)[\s-]*(\d{1,2})$/.exec(name);
  const canon = ALIASES[norm(name)] || (m ? ALIASES[norm(m[1])] : undefined);
  if (!canon) return null;
  return { name: NUMBERED.has(canon) && m && !ALIASES[norm(name)] ? `${canon} ${m[2]}` : canon, note };
}

// ---------- fontes ----------
const PRIMARY_HOSTS = ["globo.com", "cbf.com.br", "conmebol.com", "uefa.com", "fifa.com", "espn.com.br", "tntsports.com.br", "cazetv.com.br", "primevideo.com", "max.com", "paramountplus.com", "premiere.globo.com"];
const NEWS_HOSTS = ["lance.com.br", "gazetaesportiva.com", "uol.com.br", "terra.com.br", "olhardigital.com.br", "oficinadanet.com.br", "mantosdofutebol.com.br", "goal.com", "cnnbrasil.com.br", "metropoles.com", "estadao.com.br", "folha.uol.com.br", "gazetadopovo.com.br", "tecmundo.com.br", "techtudo.com.br"];
const under = (host, list) => list.some((d) => host === d || host.endsWith(`.${d}`));

/** O domínio de uma fonte do Gemini. O endereço costuma ser um redirecionamento do Google; o TÍTULO costuma trazer o domínio. */
export function hostOf(source) {
  const title = String((source && source.title) || "").toLowerCase().trim().replace(/^www\./, "");
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(title)) return title;
  try {
    const h = new URL(String(source && source.uri)).hostname.replace(/^www\./, "").toLowerCase();
    return /(^|\.)google\.|googleusercontent|vertexaisearch/.test(h) ? "" : h;
  } catch { return ""; }
}

/** Fonte confiável = pelo menos 1 de emissora/federação/ge, OU pelo menos 2 portais de notícia diferentes. */
export function assessSources(sources) {
  const hosts = [...new Set((sources || []).map(hostOf).filter(Boolean))];
  const primary = hosts.filter((h) => under(h, PRIMARY_HOSTS));
  const news = hosts.filter((h) => !under(h, PRIMARY_HOSTS) && under(h, NEWS_HOSTS));
  return { hosts, primary, news, trusted: primary.length >= 1 || news.length >= 2 };
}

// ---------- o que a IA devolve ----------
/** Tira o JSON da resposta (aceita cerca de markdown e texto em volta). null se não achar. */
export function parseModelJson(text) {
  const s = String(text || "");
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  if (a < 0 || b <= a) return null;
  try { const v = JSON.parse(s.slice(a, b + 1)); return Array.isArray(v) ? v : null; } catch { return null; }
}

/**
 * Confere o que o Gemini respondeu contra o que a gente PERGUNTOU. `askedIds`: os jogos enviados; `parsed`: a lista já lida;
 * `sources`: as fontes que o Google usou. Devolve { accepted: [{ fixtureId, channels, unknown }], rejected: [{ id, reason }], sources }.
 */
export function validateBroadcasts({ askedIds, parsed, sources }) {
  const asked = new Set((askedIds || []).map(Number));
  const src = assessSources(sources);
  const accepted = [], rejected = [], seen = new Set();
  if (!Array.isArray(parsed)) return { accepted, rejected: [{ id: null, reason: "a resposta não é uma lista de jogos" }], sources: src };
  for (const it of parsed) {
    const id = Number(it && it.id);
    if (!Number.isInteger(id) || !asked.has(id)) { rejected.push({ id: it && it.id != null ? it.id : null, reason: "jogo que não foi perguntado" }); continue; }
    if (seen.has(id)) { rejected.push({ id, reason: "jogo repetido" }); continue; }
    seen.add(id);
    const raw = Array.isArray(it.canais) ? it.canais : Array.isArray(it.channels) ? it.channels : [];
    const channels = [], unknown = [];
    for (const c of raw.slice(0, 8)) {
      const n = normalizeChannel(c && (c.nome != null ? c.nome : c.name), c && (c.obs != null ? c.obs : c.note));
      if (!n) { unknown.push(String(c && (c.nome != null ? c.nome : c.name)).slice(0, 40)); continue; }
      if (!channels.some((x) => x.name === n.name && x.note === n.note)) channels.push(n);
    }
    if (channels.length === 0) { rejected.push({ id, reason: unknown.length ? `canal desconhecido: ${unknown.join(", ")}` : "sem canais" }); continue; }
    if (!src.trusted) { rejected.push({ id, reason: "fonte não confiável" }); continue; }
    accepted.push({ fixtureId: id, channels: channels.slice(0, 6), unknown });
  }
  return { accepted, rejected, sources: src };
}

// ---------- quais jogos, e quando atualizar ----------
const EUROPE = [["England", "Premier League"], ["Spain", "La Liga"], ["Italy", "Serie A"], ["Germany", "Bundesliga"], ["France", "Ligue 1"], ["Portugal", "Primeira Liga"]];
/** "brasil" (todo o futebol brasileiro do calendário), "europa" (grandes ligas e copas continentais) ou null (não cobrimos). */
export function tierOf(f) {
  const c = f && f.league_country, n = f && f.league_name;
  if (c === "Brazil") return "brasil";
  if (EUROPE.some(([cc, nn]) => cc === c && nn === n)) return "europa";
  if (c === "World" && /(champions league|europa league|libertadores|sudamericana)/i.test(n || "")) return "europa";
  return null;
}
const DONE = new Set(["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO", "PST"]);
export const WINDOW_BEFORE_MS = 3 * 3600 * 1000, WINDOW_AFTER_MS = 10 * 86400 * 1000;
/** O jogo está na janela em que vale mostrar o canal (de 3 h antes do início até 10 dias à frente) e ainda vai acontecer/está rolando. */
export function inWindow(f, nowMs) {
  const t = new Date(f && f.kickoff).getTime();
  return Number.isFinite(t) && t >= nowMs - WINDOW_BEFORE_MS && t <= nowMs + WINDOW_AFTER_MS && !DONE.has(f.status);
}
/** Quanto tempo o canal confirmado vale: perto do jogo muda mais, então confere mais seguido. */
export function ttlMs(kickoffMs, nowMs) {
  const d = kickoffMs - nowMs;
  return d <= 6 * 3600e3 ? 90 * 60e3 : d <= 48 * 3600e3 ? 4 * 3600e3 : 12 * 3600e3;
}
export function isStale(f, record, nowMs) {
  if (!record) return true;
  const age = nowMs - new Date(record.confirmed_at || record.confirmedAt).getTime();
  return !Number.isFinite(age) || age > ttlMs(new Date(f.kickoff).getTime(), nowMs);
}
export const BATCH_SIZE = 10;

/**
 * "Provável": canais que costumam transmitir cada competição (NÃO é confirmação de jogo). Só entra competição que alguém conferiu em fonte.
 * Para incluir outra, acrescente uma linha: [país, nome da liga como está no calendário, [canais]].
 */
const LIKELY = [
  ["Brazil", "Serie A", ["Globo", "SporTV", "Premiere"]],
  ["Brazil", "Copa Do Brasil", ["SporTV", "Prime Video", "Premiere"]],
  ["Brazil", "Serie B", ["Disney+", "ESPN"]],
];
export function likelyChannels(f) {
  const hit = LIKELY.find(([c, n]) => f && f.league_country === c && f.league_name === n);
  return hit ? hit[2] : null;
}
