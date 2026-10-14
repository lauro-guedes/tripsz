/**
 * Convites de jogo — regras PURAS (valem no servidor e no navegador, sem rede nem banco).
 * O que mexe no banco fica em lib/inviteServer.js; o código secreto, em lib/inviteToken.js.
 */
import { teamLabel } from "./textUtils";

export const INVITE_EXPIRY_DAYS = 14; // quanto tempo o link vale
export const INVITE_DAILY_LIMIT = 20; // convites criados por pessoa a cada 24 h (contra abuso)
export const INVITE_NAME_MAX = 60;
export const INVITE_CHANNELS = ["whatsapp", "email", "link"];

/** Formato do código que vai na URL (22 caracteres de base64url = 128 bits). */
export const INVITE_CODE_RE = /^[A-Za-z0-9_-]{22}$/;

/**
 * Situação do convite vista por quem o RECEBE:
 *  valid (dá pra resgatar) | expired (venceu ou foi trocado por um novo) | used (já resgatado) | notfound.
 */
export function inviteState(row, now = Date.now()) {
  if (!row) return "notfound";
  if (row.status === "claimed") return "used";
  if (row.status === "revoked") return "expired";
  const exp = new Date(row.expires_at).getTime();
  if (!Number.isFinite(exp) || exp <= now) return "expired";
  return "valid";
}

/** Situação vista por quem CONVIDOU (lista "Seus convites"): pending | claimed | expired. */
export function inviteListStatus(row, now = Date.now()) {
  const s = inviteState(row, now);
  return s === "used" ? "claimed" : s === "valid" ? "pending" : "expired";
}

/** Nome digitado por quem convida: sem espaços sobrando nem caracteres de controle, no máximo 60. */
export function cleanInviteeName(value) {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, INVITE_NAME_MAX);
}

export function firstName(fullName) {
  const n = typeof fullName === "string" ? fullName.trim() : "";
  return n ? n.split(/\s+/)[0] : "";
}

const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v) => (Number.isInteger(v) ? v : null);

/** Só os campos do jogo que viajam no convite (nada além disso é copiado). */
export function gameSnapshot(game) {
  const date = typeof game.match_date === "string" ? game.match_date.slice(0, 10) : null;
  return {
    home_team: str(game.home_team, 120),
    away_team: str(game.away_team, 120),
    home_score: int(game.home_score),
    away_score: int(game.away_score),
    match_date: /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : null,
    stadium: str(game.stadium, 160),
    city: str(game.city, 120),
    country: str(game.country, 120),
    competition: str(game.competition, 160),
    home_logo: str(game.home_logo, 400),
    away_logo: str(game.away_logo, 400),
    api_fixture_id: int(game.api_fixture_id),
  };
}

export function inviteUrl(siteUrl, code) {
  return `${String(siteUrl || "").replace(/\/+$/, "")}/convite/${code}`;
}

/* ---------- mensagem e links de compartilhamento (client) ---------- */

/** "Fui ao Arsenal 2×1 Chelsea no Emirates Stadium e lembrei de você! Crie seu Passaporte de Estádios e esse jogo já fica salvo." */
export function defaultInviteMessage(game) {
  const home = teamLabel(game.home_team);
  const away = teamLabel(game.away_team);
  const hasScore = game.home_score != null && game.away_score != null;
  const match = hasScore ? `${home} ${game.home_score}×${game.away_score} ${away}` : `${home} × ${away}`;
  const where = game.stadium ? ` no ${game.stadium}` : "";
  return `Fui ao ${match}${where} e lembrei de você! Crie seu Passaporte de Estádios e esse jogo já fica salvo.`;
}

/** Telefone digitado -> só dígitos com DDI. Sem "+" e com 10 ou 11 dígitos, assume Brasil (55). Inválido = "". */
export function normalizePhone(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const full = raw.startsWith("+") || digits.startsWith("55") && digits.length >= 12 ? digits : digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return full.length >= 11 && full.length <= 15 ? full : "";
}

/** Abre o WhatsApp já com a mensagem (com número = conversa direta; sem número = a pessoa escolhe o contato). */
export function buildWhatsAppUrl(phone, text) {
  const n = normalizePhone(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/** Abre o app de e-mail da pessoa já com assunto e texto. O servidor não envia nada. */
export function buildMailtoUrl(email, subject, body) {
  const to = typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? email.trim() : "";
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const INVITE_EMAIL_SUBJECT = "Uma lembrança da arquibancada para você";
