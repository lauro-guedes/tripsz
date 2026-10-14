/**
 * Convites de jogo — a parte que mexe no banco (SÓ no servidor).
 * As rotas em app/api/invites/* são finas: autenticam, limitam abuso e chamam estas funções.
 *
 * Segurança em resumo:
 *  - o código do convite nunca é guardado (só o hash) e nunca volta numa listagem;
 *  - quem não é dono não enxerga nem mexe (o servidor confere o dono em toda operação);
 *  - o resgate casa pelo CÓDIGO, nunca por e-mail digitado, e é idempotente;
 *  - a página pública só mostra times, placar, estádio, data, nome digitado e o primeiro nome + @ de quem convidou.
 */
import { INVITE_CHANNELS, INVITE_DAILY_LIMIT, INVITE_EXPIRY_DAYS, cleanInviteeName, gameSnapshot, inviteListStatus, inviteUrl } from "./invites";
import { hashInviteCode, newInviteCode } from "./inviteToken";
import { fail } from "./inviteShared";

// Quem usa as rotas importa tudo daqui; as peças ficam em arquivos menores.
export { INVITE_ERRORS, fail, getInviterPublic } from "./inviteShared";
export { previewInvite, redeemInvite } from "./inviteRedeem";

/* ---------- criar / reenviar / listar (quem convida) ---------- */

async function dailyCount(supabase, inviterId, now) {
  const since = new Date(now - 24 * 3600 * 1000).toISOString();
  const { count, error } = await supabase.from("game_invites").select("id", { count: "exact", head: true }).eq("inviter_id", inviterId).gte("created_at", since);
  if (error) throw new Error("count_failed");
  return count || 0;
}

async function insertInvite(supabase, { inviterId, gameId, name, channel, snap, now }) {
  const code = newInviteCode();
  const { data, error } = await supabase
    .from("game_invites")
    .insert({
      inviter_id: inviterId,
      attended_game_id: gameId,
      token_hash: hashInviteCode(code),
      invitee_name: name,
      channel,
      game_snapshot: snap,
      status: "pending",
      expires_at: new Date(now + INVITE_EXPIRY_DAYS * 24 * 3600 * 1000).toISOString(),
    })
    .select("id, invitee_name, channel, status, expires_at, created_at")
    .single();
  if (error || !data) throw new Error("insert_invite_failed");
  return { row: data, code };
}

const publicInvite = (row, now) => ({ id: row.id, inviteeName: row.invitee_name, channel: row.channel, status: inviteListStatus(row, now), createdAt: row.created_at, expiresAt: row.expires_at, claimedAt: row.claimed_at || null });

/** Cria um convite pra um jogo DA PESSOA. Devolve o link (a única vez que o código existe em claro). */
export async function createInvite(supabase, { user, gameId, inviteeName, channel, siteUrl, now = Date.now() }) {
  if (!INVITE_CHANNELS.includes(channel)) return fail("invalid_channel");
  const name = cleanInviteeName(inviteeName);
  if (!name) return fail("invalid_name");
  if (!gameId) return fail("game_not_found");

  const { data: game, error } = await supabase.from("attended_games").select("*").eq("id", gameId).eq("user_id", user.id).maybeSingle();
  if (error) return fail("server");
  if (!game) return fail("game_not_found");
  const snap = gameSnapshot(game);
  if (!snap.home_team || !snap.away_team || !snap.match_date) return fail("invalid_game");

  try {
    if ((await dailyCount(supabase, user.id, now)) >= INVITE_DAILY_LIMIT) return fail("daily_limit");
    const { row, code } = await insertInvite(supabase, { inviterId: user.id, gameId: game.id, name, channel, snap, now });
    return { ok: true, invite: publicInvite(row, now), url: inviteUrl(siteUrl, code) };
  } catch {
    return fail("server");
  }
}

/** Lista os convites de um jogo (só do dono). Nunca devolve o código nem o hash. */
export async function listInvites(supabase, { user, gameId, now = Date.now() }) {
  if (!gameId) return fail("game_not_found");
  const { data, error } = await supabase
    .from("game_invites")
    .select("id, invitee_name, channel, status, expires_at, created_at, claimed_at")
    .eq("inviter_id", user.id)
    .eq("attended_game_id", gameId)
    .neq("status", "revoked")
    .order("created_at", { ascending: true });
  if (error) return fail("server");
  return { ok: true, invites: (data || []).map((r) => publicInvite(r, now)) };
}

/** "Reenviar convite": cria um link novo (mesmo nome, canal e jogo) e INVALIDA o anterior. */
export async function resendInvite(supabase, { user, inviteId, siteUrl, now = Date.now() }) {
  const { data: old, error } = await supabase.from("game_invites").select("*").eq("id", inviteId).eq("inviter_id", user.id).maybeSingle();
  if (error) return fail("server");
  if (!old) return fail("not_found");
  if (old.status === "claimed") return fail("used");
  if (old.status === "revoked") return fail("conflict");

  try {
    if ((await dailyCount(supabase, user.id, now)) >= INVITE_DAILY_LIMIT) return fail("daily_limit");
    const { row, code } = await insertInvite(supabase, { inviterId: user.id, gameId: old.attended_game_id, name: old.invitee_name, channel: old.channel, snap: old.game_snapshot, now });
    // Só um reenvio pode "ganhar": a troca só vale se o antigo ainda não foi resgatado nem trocado.
    const { data: swapped } = await supabase.from("game_invites").update({ status: "revoked", replaced_by: row.id }).eq("id", old.id).neq("status", "claimed").neq("status", "revoked").select("id");
    if (!swapped || swapped.length === 0) {
      await supabase.from("game_invites").delete().eq("id", row.id);
      const { data: again } = await supabase.from("game_invites").select("status").eq("id", old.id).maybeSingle();
      return fail(again && again.status === "claimed" ? "used" : "conflict");
    }
    return { ok: true, invite: publicInvite(row, now), url: inviteUrl(siteUrl, code) };
  } catch {
    return fail("server");
  }
}
