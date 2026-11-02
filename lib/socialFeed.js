/** tripsz.social (Fase 2) — o feed da Home, "no estádio agora" e os posts de um perfil (SÓ no servidor). */
import { cleanUsername } from "./social";
import { FEED_PAGE, NOW_WINDOW_HOURS, decodeCursor, encodeCursor } from "./socialPostRules";
import { POST_COLS, decoratePosts, viewerContext, visibleTo } from "./socialPostsShared";
import { fail, must, miniProfile, profileByUsername, profilesByIds } from "./socialShared";

/** Posts de uma lista de autores (sem os "só eu"), mais novo primeiro, mais velhos que o cursor. */
async function fetchPosts(supabase, { authors, mineOnly = false, kind = null, cursor = null, since = null, limit = FEED_PAGE + 1 }) {
  if (authors.length === 0) return [];
  let q = supabase.from("posts").select(POST_COLS).in("author_id", authors).is("deleted_at", null);
  if (!mineOnly) q = q.neq("visibility", "private");
  if (kind) q = q.eq("kind", kind);
  if (cursor) q = q.lt("created_at", cursor.createdAt);
  if (since) q = q.gte("created_at", since);
  const { data } = must(await q.order("created_at", { ascending: false }).limit(limit));
  return data || [];
}
const byNewest = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);

/** Quem está num estádio agora: o check-in mais recente de cada pessoa que eu sigo (e o meu), das últimas horas. */
async function nowAtStadium(supabase, viewerId, ctx, now) {
  const since = new Date(now - NOW_WINDOW_HOURS * 3600 * 1000).toISOString();
  const others = [...ctx.following].filter((id) => !ctx.blocked.has(id));
  const rows = [...(await fetchPosts(supabase, { authors: others, kind: "checkin", since, limit: 60 })), ...(await fetchPosts(supabase, { authors: [viewerId], mineOnly: true, kind: "checkin", since, limit: 5 }))].sort(byNewest);
  const authors = await profilesByIds(supabase, rows.map((r) => r.author_id));
  const out = [];
  const done = new Set();
  for (const r of rows) {
    if (done.has(r.author_id) || !visibleTo(r, viewerId, ctx, authors.get(r.author_id))) continue;
    done.add(r.author_id);
    out.push({ ...miniProfile(authors.get(r.author_id)), stadium: r.stadium_name, at: r.created_at, mine: r.author_id === viewerId });
    if (out.length === 12) break;
  }
  return out;
}

/** A Home: posts e check-ins de quem eu sigo e os meus, do mais novo pro mais antigo. */
export async function getFeed(supabase, viewer, { cursor, now = Date.now() } = {}) {
  const cur = cursor ? decodeCursor(cursor) : null;
  if (cursor && !cur) return fail("invalid_field");
  const ctx = await viewerContext(supabase, viewer.id);
  const others = [...ctx.following].filter((id) => !ctx.blocked.has(id));
  const [a, b] = await Promise.all([fetchPosts(supabase, { authors: others, cursor: cur }), fetchPosts(supabase, { authors: [viewer.id], mineOnly: true, cursor: cur })]);
  const rows = [...a, ...b].sort(byNewest).slice(0, FEED_PAGE + 1);
  const page = rows.slice(0, FEED_PAGE);
  const posts = await decoratePosts(supabase, viewer.id, page, ctx);
  const last = page[page.length - 1];
  const out = { ok: true, posts, hasMore: rows.length > FEED_PAGE, nextCursor: rows.length > FEED_PAGE && last ? encodeCursor(last.created_at, last.id) : null };
  if (!cur) out.nowAtStadium = await nowAtStadium(supabase, viewer.id, ctx, now);
  return out;
}

/** Os posts (kind "post") ou check-ins (kind "checkin") de um perfil, do jeito que EU posso ver. */
export async function listProfilePosts(supabase, viewer, usernameRaw, { kind = "post", cursor } = {}) {
  const username = cleanUsername(usernameRaw);
  if (!username) return fail("invalid_username");
  if (kind !== "post" && kind !== "checkin") return fail("invalid_field");
  const cur = cursor ? decodeCursor(cursor) : null;
  if (cursor && !cur) return fail("invalid_field");
  const row = await profileByUsername(supabase, username);
  if (!row) return fail("not_found");
  const ctx = await viewerContext(supabase, viewer.id);
  const self = row.user_id === viewer.id;
  if (!self && ctx.blocked.has(row.user_id)) return fail("not_found");
  if (!self && row.is_private && !ctx.following.has(row.user_id)) return { ok: true, locked: true, posts: [], hasMore: false, nextCursor: null };
  const rows = await fetchPosts(supabase, { authors: [row.user_id], mineOnly: self, kind, cursor: cur });
  const page = rows.slice(0, FEED_PAGE);
  const posts = await decoratePosts(supabase, viewer.id, page, ctx);
  const last = page[page.length - 1];
  return { ok: true, locked: false, posts, hasMore: rows.length > FEED_PAGE, nextCursor: rows.length > FEED_PAGE && last ? encodeCursor(last.created_at, last.id) : null };
}
