/**
 * tripsz.social — regras PURAS (valem no servidor e no navegador, sem rede nem banco).
 * O que mexe no banco fica em lib/social*.js (server).
 */
export const BIO_MAX = 150;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;
export const CITY_MAX = 60;
export const PAGE_SIZE = 30;
export const FOLLOW_DAILY_LIMIT = 200; // pessoas seguidas por dia (contra spam)
export const REPORT_DAILY_LIMIT = 10;
export const URL_MAX = 500;

/** "Selecione seu perfil" do onboarding (pode marcar mais de um). */
export const PROFILE_KINDS = ["Groundhopper", "Torcedor", "Viajante", "Colecionador"];

export const REPORT_REASONS = [
  { id: "spam", label: "Spam ou propaganda" },
  { id: "assedio", label: "Assédio ou bullying" },
  { id: "nudez", label: "Nudez ou conteúdo sexual" },
  { id: "violencia", label: "Violência ou ameaça" },
  { id: "falso", label: "Perfil falso ou golpe" },
  { id: "outro", label: "Outro motivo" },
];
export const REPORT_REASON_IDS = REPORT_REASONS.map((r) => r.id);

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const HANDLE = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/;

/** "@Ana.Santos " -> "ana.santos". Texto que não pode ser um @ (formato do banco): "". */
export function cleanUsername(raw) {
  const u = String(raw ?? "").trim().replace(/^@+/, "").toLowerCase();
  return HANDLE.test(u) && !/[._]{2}/.test(u) ? u : "";
}

/** Texto livre: sem caracteres de controle, no máximo 2 quebras de linha seguidas, cortado em `max`. "" = vazio. */
function tidy(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL, " ").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max).trim();
}

/** Bio: até 150 caracteres. "" = vazia. */
export const cleanBio = (value) => tidy(value, BIO_MAX);

/** Texto de uma denúncia: até 500 caracteres. "" = vazio. */
export const DETAILS_MAX = 500;
export const cleanDetails = (value) => tidy(value, DETAILS_MAX);

/** Nome público: 2 a 40 caracteres, sem controle, espaços simples. "" = inválido. */
export function cleanDisplayName(value) {
  if (typeof value !== "string") return "";
  const t = value.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, DISPLAY_NAME_MAX).trim();
  return t.length >= DISPLAY_NAME_MIN ? t : "";
}

export function cleanCity(value) {
  return typeof value === "string" ? value.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, CITY_MAX) : "";
}

/** Só os perfis da lista, sem repetir, na ordem da lista. */
export function cleanKinds(list) {
  const want = new Set(Array.isArray(list) ? list : []);
  return PROFILE_KINDS.filter((k) => want.has(k));
}

/**
 * A foto de capa/de perfil só pode vir de lugares conhecidos (evita imagem de rastreamento ou de terceiros no perfil):
 *  - o Storage do próprio projeto, SÓ na pasta da própria pessoa (bucket "social"; o avatar também aceita o "avatars" antigo);
 *  - upload.wikimedia.org (fotos de estádio sugeridas) — só pra capa;
 *  - lh3.googleusercontent.com (foto do Google) — só pra perfil;
 *  - `extraAllowed`: a foto que JÁ está no cadastro da própria pessoa (login com Google ou outro provedor) — só pra perfil.
 * `kind`: "cover" | "avatar".
 */
export function isAllowedMediaUrl(url, kind, { uid, supabaseUrl, extraAllowed = [] } = {}) {
  if (typeof url !== "string" || url.length > URL_MAX) return false;
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  if (kind === "avatar" && extraAllowed.includes(url)) return true;
  let base = null;
  try {
    base = supabaseUrl ? new URL(supabaseUrl) : null;
  } catch {
    base = null;
  }
  if (base && u.host === base.host) {
    const prefixes = [`/storage/v1/object/public/social/${uid}/`];
    if (kind === "avatar") prefixes.push(`/storage/v1/object/public/avatars/${uid}/`);
    return !!uid && prefixes.some((p) => u.pathname.startsWith(p) && !u.pathname.slice(p.length).includes(".."));
  }
  if (u.host === "upload.wikimedia.org") return kind === "cover";
  if (u.host === "lh3.googleusercontent.com") return kind === "avatar";
  return false;
}

/** "Lauro Guedes" -> "LG"; "Lauro" -> "LA"; "" -> "?". */
export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Como eu me relaciono com a pessoa. `iFollow`/`followsMe`: null | "accepted" | "pending".
 * state: self | blocked | none | following | requested. followsYou: ela me segue (aceito).
 */
export function relationOf({ self = false, blockedByMe = false, iFollow = null, followsMe = null } = {}) {
  if (self) return { state: "self", followsYou: false };
  if (blockedByMe) return { state: "blocked", followsYou: false };
  return { state: iFollow === "accepted" ? "following" : iFollow === "pending" ? "requested" : "none", followsYou: followsMe === "accepted" };
}

/** Aba "Amigos" = quem eu sigo e que me segue de volta (seguir e ser amigo é a mesma ação). */
export function mutualOf(followingSet, followersSet) {
  return [...followingSet].filter((id) => followersSet.has(id));
}

/** Amigos em comum: quantas pessoas as duas seguem (aceito). */
export function commonCount(a, b) {
  let n = 0;
  for (const id of a) if (b.has(id)) n++;
  return n;
}

/** "há 2 min", "há 3 h", "há 4 d", "agora". */
export function timeAgo(iso, now = Date.now()) {
  if (iso == null || iso === "") return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `há ${Math.floor(s / 86400)} d`;
  if (s < 86400 * 365) return `há ${Math.floor(s / (86400 * 30))} m`;
  return `há ${Math.floor(s / (86400 * 365))} a`;
}
