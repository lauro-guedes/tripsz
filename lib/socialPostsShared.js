/**
 * tripsz.social (Fase 2) — leitura de posts (SÓ no servidor): quem pode ver, e o post como as TELAS veem (sem ids de usuário).
 */
import { canSeePost } from "./socialPostRules";
import { blockedEither, followGraph, miniProfile, must, profilesByIds } from "./socialShared";

export const POST_COLS = "id, author_id, kind, body, photos, stadium_name, stadium_city, stadium_country, game_home, game_away, game_date, game_competition, game_fixture_id, visibility, created_at";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Quem eu sigo (aceito) e com quem há bloqueio em qualquer sentido. */
export async function viewerContext(supabase, viewerId) {
  const [g, b] = await Promise.all([followGraph(supabase, viewerId), blockedEither(supabase, viewerId)]);
  return { following: new Set(g.following), blocked: new Set([...b.byMe, ...b.me]) };
}

export function visibleTo(row, viewerId, ctx, authorProfile) {
  if (!authorProfile) return false;
  return canSeePost({ authorId: row.author_id, viewerId, visibility: row.visibility, authorPrivate: !!authorProfile.is_private, viewerFollowsAuthor: ctx.following.has(row.author_id), blocked: ctx.blocked.has(row.author_id) });
}

/** Tira o que o visitante não pode ver e monta cada post pra tela (curtidas, comentários, autor). Mantém a ordem. */
export async function decoratePosts(supabase, viewerId, rows, ctx) {
  const authors = await profilesByIds(supabase, rows.map((r) => r.author_id));
  const seen = rows.filter((r) => visibleTo(r, viewerId, ctx, authors.get(r.author_id)));
  if (seen.length === 0) return [];
  const ids = seen.map((r) => r.id);
  const [likes, comments] = await Promise.all([
    supabase.from("post_likes").select("post_id, user_id").in("post_id", ids).limit(20000),
    supabase.from("post_comments").select("post_id").in("post_id", ids).is("deleted_at", null).limit(20000),
  ]);
  must(likes);
  must(comments);
  const likeCount = new Map();
  const liked = new Set();
  for (const l of likes.data || []) {
    likeCount.set(l.post_id, (likeCount.get(l.post_id) || 0) + 1);
    if (l.user_id === viewerId) liked.add(l.post_id);
  }
  const commentCount = new Map();
  for (const c of comments.data || []) commentCount.set(c.post_id, (commentCount.get(c.post_id) || 0) + 1);
  return seen.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body || null,
    photos: r.photos || [],
    stadium: { name: r.stadium_name, city: r.stadium_city || null, country: r.stadium_country || null },
    game: r.game_home || r.game_away ? { home: r.game_home || null, away: r.game_away || null, date: r.game_date || null, competition: r.game_competition || null } : null,
    visibility: r.visibility,
    createdAt: r.created_at,
    author: miniProfile(authors.get(r.author_id)),
    likes: likeCount.get(r.id) || 0,
    comments: commentCount.get(r.id) || 0,
    likedByMe: liked.has(r.id),
    mine: r.author_id === viewerId,
  }));
}
