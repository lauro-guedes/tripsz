/** tripsz.social (Fase 2) — o feed da Home, "no estádio agora" e os posts de um perfil (SÓ no servidor). */
import { cleanUsername } from "./social";
import { FEED_PAGE, NOW_WINDOW_HOURS, decodeCursor, encodeCursor } from "./socialPostRules";
import { POST_COLS, decoratePosts, viewerContext, visibleTo } from "./socialPostsShared";
import { fail, must, miniProfile, profileByUsername, profilesByIds } from "./socialShared";

/** Posts de uma lista de autores (sem os "só eu"), mais novo primeiro, mais velhos que o cursor. `everyone`: os PÚBLICOS de qualquer pessoa. */
async function fetchPosts(supabase, { authors = [], everyone = false, mineOnly = false, kind = null, cursor = null, since = null, limit = FEED_PAGE + 1 }) {
  if (!everyone && authors.length === 0) return [];
  let q = supabase.from("posts").select(POST_COLS).is("deleted_at", null);
  q = everyone ? q.eq("visibility", "public") : q.in("author_id", authors);
  if (!mineOnly && !everyone) q = q.neq("visibility", "private");
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

const FETCH = FEED_PAGE * 3 + 1; // busca a mais: parte pode sumir na hora de mostrar (perfil privado que eu não sigo, bloqueio)

/**
 * A Home. scope "seguindo": posts e check-ins de quem eu sigo e os meus. scope "todos": os posts PÚBLICOS de qualquer pessoa
 * (de perfil privado só se eu seguir) e os meus. Do mais novo pro mais antigo.
 */
export async function getFeed(supabase, viewer, { cursor, scope = "seguindo", kind = null, now = Date.now() } = {}) {
  if (scope !== "seguindo" && scope !== "todos") return fail("invalid_field");
  if (kind !== null && kind !== "checkin") return fail("invalid_field");
  const since = kind ? new Date(now - 24 * 3600 * 1000).toISOString() : null; // kind "checkin": só os check-ins das últimas 24 h (aba Hoje de Estádios)
  const cur = cursor ? decodeCursor(cursor) : null;
  if (cursor && !cur) return fail("invalid_field");
  const ctx = await viewerContext(supabase, viewer.id);
  const others = [...ctx.following].filter((id) => !ctx.blocked.has(id));
  // "todos" é um SUPERCONJUNTO de "seguindo": os públicos de qualquer pessoa + tudo o que eu veria de quem sigo + os meus
  const [pub, fol, mine] = await Promise.all([
    scope === "todos" ? fetchPosts(supabase, { everyone: true, kind, since, cursor: cur, limit: FETCH }) : [],
    fetchPosts(supabase, { authors: others, kind, since, cursor: cur, limit: FETCH }),
    fetchPosts(supabase, { authors: [viewer.id], mineOnly: true, kind, since, cursor: cur, limit: FETCH }),
  ]);
  const seen = new Set();
  const rows = [...pub, ...fol, ...mine].filter((r) => (seen.has(r.id) ? false : seen.add(r.id))).sort(byNewest).slice(0, FETCH);
  const decorated = await decoratePosts(supabase, viewer.id, rows, ctx);
  const posts = decorated.slice(0, FEED_PAGE);
  const more = decorated.length > FEED_PAGE || rows.length >= FETCH;
  // a página seguinte começa depois do último item MOSTRADO; se nada sobrou pra mostrar, depois do último item que olhamos
  const lastShown = decorated.length > FEED_PAGE ? posts[posts.length - 1] : null;
  const lastRow = rows[rows.length - 1];
  const nextCursor = more ? (lastShown ? encodeCursor(lastShown.createdAt, lastShown.id) : lastRow ? encodeCursor(lastRow.created_at, lastRow.id) : null) : null;
  const out = { ok: true, posts, hasMore: more && !!nextCursor, nextCursor };
  if (!cur && !kind) out.nowAtStadium = await nowAtStadium(supabase, viewer.id, ctx, now);
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

/**
 * "Mais check-ins hoje": os jogos com mais pessoas com check-in PÚBLICO nas últimas 24 h (só os que têm jogo informado).
 * Devolve só contagens e o jogo (nada de quem fez o check-in).
 */
export async function getTodayCheckins(supabase, { now = Date.now() } = {}) {
  const since = new Date(now - 24 * 3600 * 1000).toISOString();
  const { data } = must(await supabase.from("posts").select("author_id, game_fixture_id").eq("kind", "checkin").eq("visibility", "public").is("deleted_at", null).gte("created_at", since).limit(5000));
  const by = new Map();
  for (const r of data || []) {
    if (r.game_fixture_id == null) continue;
    const set = by.get(r.game_fixture_id) || new Set();
    set.add(r.author_id);
    by.set(r.game_fixture_id, set);
  }
  const top = [...by.entries()].map(([id, set]) => ({ id, count: set.size })).sort((a, b) => b.count - a.count || a.id - b.id).slice(0, 5);
  if (top.length === 0) return { ok: true, games: [] };
  const { data: fx } = must(await supabase.from("fixtures_calendar").select("fixture_id, kickoff, home_team, away_team, league_name, venue_name, venue_city").in("fixture_id", top.map((t) => t.id)));
  const info = new Map((fx || []).map((r) => [Number(r.fixture_id), r]));
  const games = top.filter((t) => info.has(Number(t.id))).map((t) => { const r = info.get(Number(t.id)); return { fixtureId: Number(t.id), home: r.home_team, away: r.away_team, competition: r.league_name || null, stadium: r.venue_name || null, city: r.venue_city || null, kickoff: r.kickoff, count: t.count }; });
  return { ok: true, games };
}
