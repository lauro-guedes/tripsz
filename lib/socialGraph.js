/** tripsz.social — seguir (= ser amigo), pedidos, listas e bloqueios (SÓ no servidor). */
import { FOLLOW_DAILY_LIMIT, PAGE_SIZE, cleanUsername, commonCount, mutualOf, relationOf } from "./social";
import { blockedEither, fail, followGraph, gamesByUsers, lastGameOf, miniProfile, passportStats, profileByUsername, profilesByIds } from "./socialShared";

async function target(supabase, viewer, usernameRaw) {
  const username = cleanUsername(usernameRaw);
  if (!username) return { err: fail("invalid_username") };
  const row = await profileByUsername(supabase, username);
  if (!row) return { err: fail("not_found") };
  if (row.user_id === viewer.id) return { err: fail("self") };
  return { row };
}

/** Seguir. Perfil público: já segue. Perfil privado: vira pedido (pending) até a pessoa aprovar. Repetir não muda nada. */
export async function followUser(supabase, viewer, usernameRaw, { now = Date.now() } = {}) {
  const { row, err } = await target(supabase, viewer, usernameRaw);
  if (err) return err;
  const block = await blockedEither(supabase, viewer.id);
  if (block.me.has(row.user_id)) return fail("not_found"); // quem me bloqueou "não existe" pra mim
  if (block.byMe.has(row.user_id)) return fail("blocked");
  const { data: edge } = await supabase.from("follows").select("status").eq("follower_id", viewer.id).eq("followee_id", row.user_id).maybeSingle();
  if (edge) return { ok: true, relation: relationOf({ iFollow: edge.status }) };
  const since = new Date(now - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", viewer.id).gte("created_at", since);
  if ((count || 0) >= FOLLOW_DAILY_LIMIT) return fail("daily_limit");
  const status = row.is_private ? "pending" : "accepted";
  const { error } = await supabase.from("follows").insert({ follower_id: viewer.id, followee_id: row.user_id, status, accepted_at: status === "accepted" ? new Date(now).toISOString() : null });
  if (error && error.code !== "23505") return fail("server"); // 23505 = já existia (disputa)
  return { ok: true, relation: relationOf({ iFollow: status }) };
}

/** Deixar de seguir (ou cancelar o pedido). */
export async function unfollowUser(supabase, viewer, usernameRaw) {
  const { row, err } = await target(supabase, viewer, usernameRaw);
  if (err) return err;
  const { error } = await supabase.from("follows").delete().eq("follower_id", viewer.id).eq("followee_id", row.user_id);
  if (error) return fail("server");
  return { ok: true, relation: relationOf({}) };
}

/** Perfil privado: aceitar ou recusar o pedido de `usernameRaw`. */
export async function respondRequest(supabase, viewer, usernameRaw, action, { now = Date.now() } = {}) {
  if (action !== "accept" && action !== "decline") return fail("invalid_field");
  const { row, err } = await target(supabase, viewer, usernameRaw);
  if (err) return err;
  const { data: edge } = await supabase.from("follows").select("status").eq("follower_id", row.user_id).eq("followee_id", viewer.id).eq("status", "pending").maybeSingle();
  if (!edge) return fail("not_found", "Esse pedido não existe mais.");
  const q = action === "accept" ? supabase.from("follows").update({ status: "accepted", accepted_at: new Date(now).toISOString() }) : supabase.from("follows").delete();
  const { error } = await q.eq("follower_id", row.user_id).eq("followee_id", viewer.id).eq("status", "pending");
  if (error) return fail("server");
  return { ok: true, status: action === "accept" ? "accepted" : "declined" };
}

/**
 * As listas da tela Amigos. amigos = quem eu sigo e me segue de volta; seguidores; seguindo; solicitacoes = pedidos pra EU aprovar.
 * Bloqueados (em qualquer sentido) não aparecem. Perfil privado que eu não sigo não mostra estatísticas nem o último jogo.
 */
export async function listFriends(supabase, viewer, tab, { offset = 0, limit = PAGE_SIZE } = {}) {
  if (!["amigos", "seguidores", "seguindo", "solicitacoes"].includes(tab)) return fail("invalid_field");
  const [graph, block] = await Promise.all([followGraph(supabase, viewer.id), blockedEither(supabase, viewer.id)]);
  const hidden = (id) => block.byMe.has(id) || block.me.has(id);
  const following = graph.following.filter((id) => !hidden(id));
  const followers = graph.followers.filter((id) => !hidden(id));
  const requestsIn = graph.requestsIn.filter((id) => !hidden(id));
  const friends = mutualOf(new Set(following), new Set(followers));
  const lists = { amigos: friends, seguidores: followers, seguindo: following, solicitacoes: requestsIn };
  const all = lists[tab];
  const start = Math.max(0, Number(offset) || 0);
  const lim = Math.min(Math.max(1, Number(limit) || PAGE_SIZE), 100);
  const ids = all.slice(start, start + lim);
  const [profiles, games] = await Promise.all([profilesByIds(supabase, ids), tab === "solicitacoes" ? new Map() : gamesByUsers(supabase, ids)]);
  const myFollowing = new Set(following);
  const rows = [];
  for (const id of ids) {
    const p = profiles.get(id);
    if (!p) continue;
    const row = { ...miniProfile(p), iFollow: myFollowing.has(id), kinds: p.profile_kinds || [] };
    if (tab === "solicitacoes") {
      const theirs = await followGraph(supabase, id);
      row.common = commonCount(myFollowing, new Set(theirs.following));
    } else if (!p.is_private || myFollowing.has(id)) {
      const g = games.get(id) || [];
      const s = passportStats(g);
      row.stats = { stadiums: s.stadiums, countries: s.countries };
      row.lastGame = lastGameOf(g);
    }
    rows.push(row);
  }
  return { ok: true, tab, counts: { amigos: friends.length, seguidores: followers.length, seguindo: following.length, solicitacoes: requestsIn.length }, rows, hasMore: start + lim < all.length };
}

/** Bloquear: some das listas, deixa de ver e de ser visto, e os dois deixam de se seguir. */
export async function blockUser(supabase, viewer, usernameRaw) {
  const { row, err } = await target(supabase, viewer, usernameRaw);
  if (err) return err;
  const { error } = await supabase.from("user_blocks").insert({ blocker_id: viewer.id, blocked_id: row.user_id });
  if (error && error.code !== "23505") return fail("server");
  await supabase.from("follows").delete().eq("follower_id", viewer.id).eq("followee_id", row.user_id);
  await supabase.from("follows").delete().eq("follower_id", row.user_id).eq("followee_id", viewer.id);
  return { ok: true };
}

export async function unblockUser(supabase, viewer, usernameRaw) {
  const { row, err } = await target(supabase, viewer, usernameRaw);
  if (err) return err;
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", viewer.id).eq("blocked_id", row.user_id);
  return error ? fail("server") : { ok: true };
}

export async function listBlocks(supabase, viewer) {
  const { data, error } = await supabase.from("user_blocks").select("blocked_id, created_at").eq("blocker_id", viewer.id).order("created_at", { ascending: false }).limit(500);
  if (error) return fail("server");
  const profiles = await profilesByIds(supabase, (data || []).map((r) => r.blocked_id));
  return { ok: true, blocked: (data || []).map((r) => profiles.get(r.blocked_id)).filter(Boolean).map(miniProfile) };
}
