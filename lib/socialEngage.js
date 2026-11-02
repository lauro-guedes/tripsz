/** tripsz.social (Fase 2) — curtidas e comentários (SÓ no servidor). Só dá pra interagir com o que a pessoa pode ver. */
import { COMMENTS_PER_DAY, COMMENT_PAGE, cleanComment } from "./socialPostRules";
import { POST_COLS, UUID, viewerContext, visibleTo } from "./socialPostsShared";
import { fail, miniProfile, must, profileById, profilesByIds } from "./socialShared";

const gone = () => fail("not_found", "Publicação não encontrada.");

async function visiblePost(supabase, viewer, id) {
  if (!UUID.test(String(id))) return { err: gone() };
  const { data: row } = must(await supabase.from("posts").select(POST_COLS).eq("id", id).is("deleted_at", null).maybeSingle());
  if (!row) return { err: gone() };
  const ctx = await viewerContext(supabase, viewer.id);
  if (!visibleTo(row, viewer.id, ctx, await profileById(supabase, row.author_id))) return { err: gone() };
  return { row, ctx };
}

async function likeState(supabase, viewerId, postId) {
  const [all, mine] = await Promise.all([supabase.from("post_likes").select("user_id", { count: "exact", head: true }).eq("post_id", postId), supabase.from("post_likes").select("user_id").eq("post_id", postId).eq("user_id", viewerId).maybeSingle()]);
  must(all);
  must(mine);
  return { likes: all.count || 0, likedByMe: !!mine.data };
}

export async function likePost(supabase, viewer, id) {
  const { err } = await visiblePost(supabase, viewer, id);
  if (err) return err;
  const { error } = await supabase.from("post_likes").insert({ post_id: id, user_id: viewer.id });
  if (error && error.code !== "23505") return fail("server");
  return { ok: true, ...(await likeState(supabase, viewer.id, id)) };
}

export async function unlikePost(supabase, viewer, id) {
  const { err } = await visiblePost(supabase, viewer, id);
  if (err) return err;
  const { error } = await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", viewer.id);
  if (error) return fail("server");
  return { ok: true, ...(await likeState(supabase, viewer.id, id)) };
}

const commentView = (c, author, viewerId, postAuthorId) => ({ id: c.id, body: c.body, createdAt: c.created_at, author: miniProfile(author), mine: c.author_id === viewerId, canDelete: c.author_id === viewerId || postAuthorId === viewerId });

/** Comentários de um post, do mais antigo pro mais novo. Quem tem bloqueio com a pessoa não aparece. */
export async function listComments(supabase, viewer, id) {
  const { row, ctx, err } = await visiblePost(supabase, viewer, id);
  if (err) return err;
  const { data } = must(await supabase.from("post_comments").select("id, author_id, body, created_at").eq("post_id", id).is("deleted_at", null).order("created_at", { ascending: true }).limit(COMMENT_PAGE));
  const rows = (data || []).filter((c) => !ctx.blocked.has(c.author_id));
  const authors = await profilesByIds(supabase, rows.map((c) => c.author_id));
  return { ok: true, comments: rows.filter((c) => authors.has(c.author_id)).map((c) => commentView(c, authors.get(c.author_id), viewer.id, row.author_id)) };
}

export async function addComment(supabase, viewer, id, bodyRaw, { now = Date.now() } = {}) {
  const { row, err } = await visiblePost(supabase, viewer, id);
  if (err) return err;
  const body = cleanComment(bodyRaw);
  if (!body) return fail("invalid_field", "Escreva um comentário.");
  const since = new Date(now - 24 * 3600 * 1000).toISOString();
  const { count } = must(await supabase.from("post_comments").select("id", { count: "exact", head: true }).eq("author_id", viewer.id).gte("created_at", since));
  if ((count || 0) >= COMMENTS_PER_DAY) return fail("daily_limit");
  const { data, error } = await supabase.from("post_comments").insert({ post_id: id, author_id: viewer.id, body }).select("id, author_id, body, created_at").single();
  if (error || !data) return fail("server");
  return { ok: true, comment: commentView(data, await profileById(supabase, viewer.id), viewer.id, row.author_id) };
}

/** Apaga um comentário: quem escreveu ou o dono do post. */
export async function deleteComment(supabase, viewer, commentId) {
  if (!UUID.test(String(commentId))) return fail("not_found", "Comentário não encontrado.");
  const { data: c } = must(await supabase.from("post_comments").select("id, post_id, author_id").eq("id", commentId).is("deleted_at", null).maybeSingle());
  if (!c) return fail("not_found", "Comentário não encontrado.");
  const { data: post } = must(await supabase.from("posts").select("author_id").eq("id", c.post_id).maybeSingle());
  if (c.author_id !== viewer.id && !(post && post.author_id === viewer.id)) return fail("not_found", "Comentário não encontrado.");
  const { error } = await supabase.from("post_comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId);
  return error ? fail("server") : { ok: true };
}
