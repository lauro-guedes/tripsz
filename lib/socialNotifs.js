/**
 * tripsz.social — notificações do sino (SÓ no servidor): novos seguidores, pedidos para seguir, curtidas e comentários nas
 * minhas publicações. Tudo lido das tabelas follows, post_likes e post_comments; só guardamos QUANDO a pessoa viu pela última vez
 * (profiles.social_notifs_seen_at). Nada de id nem e-mail na resposta.
 */
import { blockedEither, fail, miniProfile, must, profilesByIds } from "./socialShared";

const WINDOW_DAYS = 30;
const MAX_ITEMS = 50;

const snippet = (s, n = 80) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}...` : t;
};

/** As notificações dos últimos 30 dias (mais nova primeiro) e quantas ainda não vi. */
export async function listNotifications(supabase, viewer, { now = Date.now() } = {}) {
  const since = new Date(now - WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  const [me, block, follows, posts] = await Promise.all([
    supabase.from("profiles").select("social_notifs_seen_at").eq("user_id", viewer.id).maybeSingle(),
    blockedEither(supabase, viewer.id),
    supabase.from("follows").select("follower_id, status, created_at").eq("followee_id", viewer.id).gte("created_at", since).order("created_at", { ascending: false }).limit(60),
    supabase.from("posts").select("id, body, stadium_name").eq("author_id", viewer.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
  ]);
  const seenAt = must(me).data && must(me).data.social_notifs_seen_at ? new Date(must(me).data.social_notifs_seen_at).getTime() : 0;
  const mine = new Map((must(posts).data || []).map((p) => [p.id, p]));
  const ids = [...mine.keys()];
  const [likes, comments] = ids.length
    ? await Promise.all([
        supabase.from("post_likes").select("post_id, user_id, created_at").in("post_id", ids).neq("user_id", viewer.id).gte("created_at", since).order("created_at", { ascending: false }).limit(100),
        supabase.from("post_comments").select("id, post_id, author_id, body, created_at").in("post_id", ids).neq("author_id", viewer.id).is("deleted_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(100),
      ])
    : [{ data: [] }, { data: [] }];

  const raw = [];
  for (const f of must(follows).data || []) raw.push({ key: `f:${f.follower_id}`, type: f.status === "pending" ? "follow_request" : "follow", actor: f.follower_id, at: f.created_at });
  for (const l of must(likes).data || []) raw.push({ key: `l:${l.post_id}:${l.user_id}`, type: "like", actor: l.user_id, at: l.created_at, post: mine.get(l.post_id) });
  for (const c of must(comments).data || []) raw.push({ key: `c:${c.id}`, type: "comment", actor: c.author_id, at: c.created_at, post: mine.get(c.post_id), text: c.body });

  const visible = raw.filter((r) => !block.byMe.has(r.actor) && !block.me.has(r.actor)).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, MAX_ITEMS);
  const profiles = await profilesByIds(supabase, visible.map((r) => r.actor));
  const items = [];
  for (const r of visible) {
    const p = profiles.get(r.actor);
    if (!p) continue;
    items.push({
      id: r.key,
      type: r.type,
      actor: miniProfile(p),
      createdAt: r.at,
      unread: new Date(r.at).getTime() > seenAt,
      postText: r.post ? snippet(r.post.body) || r.post.stadium_name || null : null,
      commentText: r.text ? snippet(r.text) : null,
    });
  }
  return { ok: true, items, unread: items.filter((i) => i.unread).length };
}

/** "Vi tudo": zera o contador do sino. */
export async function markNotificationsSeen(supabase, viewer, { now = Date.now() } = {}) {
  const { error } = await supabase.from("profiles").update({ social_notifs_seen_at: new Date(now).toISOString() }).eq("user_id", viewer.id);
  if (error) return fail("server");
  return { ok: true };
}
