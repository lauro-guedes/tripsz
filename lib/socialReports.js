/** tripsz.social — denúncias (SÓ no servidor). Ficam na tabela `reports` para a moderação analisar. */
import { REPORT_DAILY_LIMIT, REPORT_REASON_IDS, cleanDetails, cleanUsername } from "./social";
import { UUID } from "./socialPostsShared";
import { fail, must, profileByUsername } from "./socialShared";

const TYPES = ["profile", "post", "comment"];

/** Denunciar. Perfil: `targetId` é o @. Denunciar duas vezes a mesma coisa não duplica (devolve ok, already). */
export async function reportTarget(supabase, viewer, { targetType, targetId, reason, details } = {}, { now = Date.now() } = {}) {
  if (!TYPES.includes(targetType) || typeof targetId !== "string" || !targetId.trim() || targetId.length > 80) return fail("invalid_field");
  if (!REPORT_REASON_IDS.includes(reason)) return fail("invalid_reason");
  let id = targetId.trim();
  if (targetType === "profile") {
    const username = cleanUsername(id);
    if (!username) return fail("invalid_username");
    const row = await profileByUsername(supabase, username);
    if (!row) return fail("not_found");
    if (row.user_id === viewer.id) return fail("self", "Você não pode denunciar o seu próprio perfil.");
    id = username;
  }
  if (targetType === "post" || targetType === "comment") {
    if (!UUID.test(id)) return fail("not_found");
    const { data } = must(await supabase.from(targetType === "post" ? "posts" : "post_comments").select("author_id").eq("id", id).is("deleted_at", null).maybeSingle());
    if (!data) return fail("not_found");
    if (data.author_id === viewer.id) return fail("self", "Você não pode denunciar o seu próprio conteúdo.");
  }
  const since = new Date(now - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", viewer.id).gte("created_at", since);
  if ((count || 0) >= REPORT_DAILY_LIMIT) return fail("daily_limit");
  const text = cleanDetails(details);
  const { error } = await supabase.from("reports").insert({ reporter_id: viewer.id, target_type: targetType, target_id: id, reason, details: text || null });
  if (error && error.code === "23505") return { ok: true, already: true };
  if (error) return fail("server");
  return { ok: true, already: false };
}
