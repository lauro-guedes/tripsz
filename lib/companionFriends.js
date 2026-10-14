/**
 * Amigos e busca por @ (SÓ no servidor).
 *  - A busca é pelo @ EXATO (mínimo 3 caracteres) e devolve no máximo UMA pessoa. Nunca lista usuários.
 *  - "Amigo" = quem você já marcou ou convidou e que tem conta (sugestões).
 */
import { normalizeHandle, handleProblem } from "./companions";
import { fail, profilesByIds } from "./companionShared";
import { firstName } from "./invites";

export async function searchFriend(supabase, { user, query }) {
  const problem = handleProblem(query);
  if (problem === "too_short") return fail("invalid_query");
  if (problem) return { ok: true, found: false }; // formato que nenhum @ pode ter: não consulta o banco
  const { data, error } = await supabase.from("profiles").select("user_id, username, first_name").eq("username", normalizeHandle(query)).maybeSingle();
  if (error) return fail("server");
  if (!data || data.user_id === user.id) return { ok: true, found: false };
  return { ok: true, found: true, friend: { username: data.username, firstName: firstName(data.first_name) || data.username } };
}

/** Sugestões: quem você marcou + quem resgatou um convite seu, do mais recente pro mais antigo. */
export async function listFriends(supabase, { user, limit = 20 }) {
  const [tags, claims] = await Promise.all([
    supabase.from("game_companions").select("companion_id, created_at").eq("tagger_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("game_invites").select("claimed_by, claimed_at").eq("inviter_id", user.id).eq("status", "claimed").order("claimed_at", { ascending: false }).limit(200),
  ]);
  if (tags.error || claims.error) return fail("server");
  const latest = new Map(); // id -> momento mais recente
  const bump = (id, at) => {
    if (id && id !== user.id && (!latest.has(id) || String(at) > String(latest.get(id)))) latest.set(id, at);
  };
  (tags.data || []).forEach((r) => bump(r.companion_id, r.created_at));
  (claims.data || []).forEach((r) => bump(r.claimed_by, r.claimed_at));
  const ids = [...latest.keys()].sort((a, b) => (String(latest.get(a)) < String(latest.get(b)) ? 1 : -1)).slice(0, limit);
  const profiles = await profilesByIds(supabase, ids);
  return { ok: true, friends: ids.map((id) => profiles.get(id)).filter(Boolean) };
}
