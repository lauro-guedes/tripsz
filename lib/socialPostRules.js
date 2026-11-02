/**
 * tripsz.social (Fase 2) — regras PURAS de posts, check-ins, curtidas e comentários (sem rede nem banco).
 */
import { cleanText, isAllowedMediaUrl } from "./social";

export const POST_BODY_MAX = 500;
export const COMMENT_MAX = 300;
export const MAX_PHOTOS = 4;
export const FEED_PAGE = 20;
export const COMMENT_PAGE = 50;
export const POSTS_PER_DAY = 10;
export const CHECKINS_PER_DAY = 3;
export const CHECKIN_REPEAT_HOURS = 6; // não dá pra fazer check-in no mesmo estádio de novo antes disso
export const NOW_WINDOW_HOURS = 6; // "no estádio agora" = check-in dessas últimas horas
export const AT_STADIUM_M = 700; // "está no estádio" = até 700 m do ponto do estádio (o mesmo do check-in por GPS)
export const COMMENTS_PER_DAY = 200;
export const VISIBILITIES = ["public", "friends", "private"];
export const VISIBILITY_LABELS = { public: "Público", friends: "Quem me segue", private: "Só eu" };

export const cleanPostBody = (v) => cleanText(v, POST_BODY_MAX);
export const cleanComment = (v) => cleanText(v, COMMENT_MAX);
export const cleanVisibility = (v) => (VISIBILITIES.includes(v) ? v : null);

/**
 * Fotos de um post: no máximo 4, SÓ do Storage do projeto na pasta da própria pessoa. Tudo ou nada:
 * qualquer foto fora da regra recusa o post inteiro. `list` vazio/ausente = sem fotos.
 */
export function cleanPhotos(list, ctx) {
  if (list == null) return { ok: true, photos: [] };
  if (!Array.isArray(list) || list.length > MAX_PHOTOS) return { ok: false, photos: [] };
  const photos = [];
  for (const url of list) {
    if (!isAllowedMediaUrl(url, "post", ctx)) return { ok: false, photos: [] };
    if (!photos.includes(url)) photos.push(url);
  }
  return { ok: true, photos };
}

/**
 * Quem pode ver um post. `authorPrivate`: o perfil do autor é privado. `viewerFollowsAuthor`: eu sigo o autor (aceito).
 * Bloqueio em qualquer sentido esconde. O próprio autor sempre vê.
 */
export function canSeePost({ authorId, viewerId, visibility, authorPrivate = false, viewerFollowsAuthor = false, blocked = false }) {
  if (authorId === viewerId) return true;
  if (blocked) return false;
  if (visibility === "private") return false;
  if (authorPrivate && !viewerFollowsAuthor) return false;
  if (visibility === "friends") return viewerFollowsAuthor;
  return visibility === "public";
}

/** Cursor de página: a data e o id do último item da página anterior. */
export const encodeCursor = (createdAt, id) => `${createdAt}|${id}`;
export function decodeCursor(raw) {
  if (typeof raw !== "string" || raw.length > 120) return null;
  const [t, id] = raw.split("|");
  return Number.isFinite(new Date(t).getTime()) && id ? { createdAt: t, id } : null;
}
