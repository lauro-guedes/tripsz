/**
 * "Quem foi com você?" — regras PURAS (valem no servidor e no navegador, sem rede nem banco).
 */
export const MAX_COMPANIONS = 10; // amigos marcados por jogo
export const DAILY_TAG_LIMIT = 30; // marcações criadas por pessoa a cada 24 h (contra abuso)
export const SEARCH_PER_MINUTE = 15; // buscas por @ por pessoa por minuto
export const HANDLE_MIN = 3;

/** "@Ana.Santos " -> "ana.santos" */
export function normalizeHandle(raw) {
  return String(raw ?? "").trim().replace(/^@+/, "").toLowerCase();
}

const HANDLE_FORMAT = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/;

/** null = pode buscar | "too_short" (menos de 3 caracteres) | "invalid" (formato que nenhum @ pode ter). */
export function handleProblem(raw) {
  const h = normalizeHandle(raw);
  if (h.length < HANDLE_MIN) return "too_short";
  if (!HANDLE_FORMAT.test(h) || /[._]{2}/.test(h)) return "invalid";
  return null;
}

export function initialOf(name) {
  const n = String(name || "").trim();
  return n ? n.charAt(0).toUpperCase() : "?";
}

/** ["Ana"] -> "Ana" · ["Ana","Bruno"] -> "Ana e Bruno" · 3+ -> "Ana, Bruno e mais 1". */
export function namesLabel(names) {
  const list = (names || []).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} e ${list[1]}`;
  const rest = list.length - 2;
  return `${list[0]}, ${list[1]} e mais ${rest}`;
}

/** Estado de um acompanhante, como o DONO do jogo vê. ("ignored" nunca aparece: vira "waiting".) */
export function personState(status) {
  return status === "accepted" ? "accepted" : "waiting";
}

/** "Sofia Almeida" -> "SA" · "Sofia" -> "SO" · "" -> "?" */
export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
