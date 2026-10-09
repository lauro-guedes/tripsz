/**
 * Temporadas disponíveis em "Meus Jogos" (registrar jogos que a pessoa já viu).
 *
 * Antes a lista era fixa (2022–2024). Agora vai do ano atual até 2010, que é
 * onde a API-Football começa a ter dados de jogos. A API em si é quem decide
 * se o plano da conta dá acesso a cada temporada — se não der, mostramos a
 * mensagem dela de forma amigável (ver friendlySeasonError).
 *
 * Convenção da API: "temporada 2024" = a que COMEÇA em 2024 (Europa: 2024/25;
 * ligas de ano-calendário como o Brasileirão: o ano de 2024).
 */
export const MIN_SEASON = 2010;

/** A temporada mais recente que faz sentido listar: a do ano do calendário atual. */
export function maxSeason(now = new Date()) {
  return now.getFullYear();
}

export function isValidSeason(n, now = new Date()) {
  return Number.isInteger(n) && n >= MIN_SEASON && n <= maxSeason(now);
}

/** 2024 -> "2024/25" */
export function formatSeason(year) {
  return `${year}/${String(year + 1).slice(-2)}`;
}

/** Lista pro <select>: da mais nova pra mais antiga. */
export function seasonOptions(now = new Date()) {
  const out = [];
  for (let y = maxSeason(now); y >= MIN_SEASON; y--) out.push({ value: y, label: formatSeason(y) });
  return out;
}

/* ------------------------------------------------------------------
 * Dois jeitos de contar temporada:
 *  - europeia (jul–jun): "2026/27"
 *  - ano-calendário (jan–dez): "2026" — Brasileirão, Libertadores, ligas da
 *    América do Sul, MLS etc.
 * Pra API-Football as duas são o mesmo número ("temporada 2026"), então a
 * diferença é só de como mostramos e agrupamos pra pessoa.
 * ------------------------------------------------------------------ */
const norm = (v) => (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const CALENDAR_YEAR_COUNTRIES = new Set([
  "brazil", "brasil", "argentina", "chile", "colombia", "uruguay", "uruguai", "paraguay", "paraguai",
  "peru", "ecuador", "equador", "bolivia", "venezuela",
  "usa", "united states", "estados unidos", "eua", "canada",
  "japan", "japao", "south korea", "korea republic", "coreia do sul", "china",
  "sweden", "suecia", "norway", "noruega", "finland", "finlandia", "iceland", "islandia", "ireland", "irlanda",
]);
const CALENDAR_YEAR_COMPETITION = /libertadores|sul-?americana|sudamericana|recopa|copa do brasil|brasileir|serie [abcd] ?\(?brasil|mls\b/;

/** O jogo é de uma competição que conta a temporada por ano-calendário? */
export function isCalendarYearGame({ country, competition } = {}) {
  return CALENDAR_YEAR_COUNTRIES.has(norm(country)) || CALENDAR_YEAR_COMPETITION.test(norm(competition));
}

/** Temporada de um jogo registrado: { key, label, year, kind }, ordenável por `year` (e `kind`). */
export function gameSeason(dateStr, game = {}) {
  const d = new Date(dateStr);
  if (isCalendarYearGame(game)) {
    const y = d.getFullYear();
    return { key: `cal:${y}`, label: String(y), year: y, kind: "cal" };
  }
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; // europeia: jul-jun
  return { key: `eu:${y}`, label: formatSeason(y), year: y, kind: "eu" };
}

/** Ordena temporadas da mais nova pra mais antiga (na mesma data, europeia antes). */
export function compareSeasonsDesc(a, b) {
  return b.year - a.year || (a.kind === b.kind ? 0 : a.kind === "eu" ? -1 : 1);
}

/** Valor do <select> de busca ("eu:2026" / "cal:2026") -> { kind, year, label }. */
export function parseSeasonValue(value) {
  const [kind, y] = String(value).split(":");
  const year = parseInt(y, 10);
  return { kind: kind === "cal" ? "cal" : "eu", year, label: kind === "cal" ? String(year) : formatSeason(year) };
}

/** Opções do <select> da busca, em dois grupos. */
export function seasonOptionGroups(now = new Date()) {
  const eu = [];
  const cal = [];
  for (let y = maxSeason(now); y >= MIN_SEASON; y--) {
    eu.push({ value: `eu:${y}`, label: formatSeason(y) });
    cal.push({ value: `cal:${y}`, label: String(y) });
  }
  return { eu, cal };
}

/** Se o erro da API-Football é "seu plano não tem essa temporada", devolve um texto claro; senão null. */
export function friendlySeasonError(message) {
  if (/access to this season/i.test(message || "")) {
    return "A sua conta da API-Football não dá acesso a essa temporada. Escolha outra mais recente ou preencha o jogo manualmente.";
  }
  return null;
}
