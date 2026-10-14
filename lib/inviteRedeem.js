/**
 * Convites de jogo — a página pública e o resgate (SÓ no servidor).
 * Veja o resumo de segurança em inviteServer.js.
 */
import { inviteState } from "./invites";
import { hashInviteCode, looksLikeInviteCode } from "./inviteToken";
import { ensureGameFor, fail, findDuplicateGame, getInviterPublic, isoNow } from "./inviteShared";

/* ---------- página pública e resgate (quem recebe) ---------- */

async function findByCode(supabase, code) {
  if (!looksLikeInviteCode(code)) return null;
  const { data } = await supabase.from("game_invites").select("*").eq("token_hash", hashInviteCode(code)).maybeSingle();
  return data || null;
}

const PUBLIC_GAME_FIELDS = ["home_team", "away_team", "home_score", "away_score", "match_date", "stadium", "city", "country", "competition", "home_logo", "away_logo"];
const publicGame = (snap) => Object.fromEntries(PUBLIC_GAME_FIELDS.map((k) => [k, snap ? snap[k] ?? null : null]));

/**
 * O que a página /convite/<código> mostra. Sem login qualquer pessoa com o link vê:
 * times, placar, estádio, data, o nome digitado e o primeiro nome + @ de quem convidou. Mais nada.
 * `viewer` (opcional) = pessoa logada abrindo o link, pra a tela saber se é a própria dona do convite etc.
 */
export async function previewInvite(supabase, { code, viewer = null, now = Date.now() }) {
  const row = await findByCode(supabase, code);
  const state = inviteState(row, now);
  if (!row) return { ok: true, state: "notfound" };

  const out = {
    ok: true,
    state,
    game: publicGame(row.game_snapshot),
    inviter: await getInviterPublic(supabase, row.inviter_id),
    inviteeName: row.invitee_name,
    expiresAt: state === "valid" ? row.expires_at : null,
    viewer: null,
  };
  if (viewer) {
    out.viewer = {
      isInviter: viewer.id === row.inviter_id,
      claimedByMe: !!row.claimed_by && row.claimed_by === viewer.id,
      alreadyHasGame: state === "valid" && viewer.id !== row.inviter_id ? !!(await findDuplicateGame(supabase, viewer.id, row.game_snapshot)) : false,
    };
  }
  return out;
}

/** O jogo que o resgate criou (ou já existia) — ao repetir o resgate, sabe se foi duplicado: não veio de convite. */
async function describeClaimedGame(supabase, gameId) {
  const { data } = await supabase.from("attended_games").select("source").eq("id", gameId).maybeSingle();
  return { gameId, duplicate: !!data && data.source !== "invite" };
}

/** Quem PERDEU a disputa do resgate (mas é a mesma pessoa) espera o vencedor terminar de criar o jogo. */
async function waitForClaimedGame(supabase, inviteId, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const { data } = await supabase.from("game_invites").select("claimed_game_id").eq("id", inviteId).maybeSingle();
    if (data && data.claimed_game_id) return data.claimed_game_id;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

/**
 * Resgata o convite pra pessoa logada: o jogo entra no Passaporte dela (sem duplicar).
 * Idempotente: chamar de novo devolve o mesmo resultado. O convite é achado pelo CÓDIGO, nunca por e-mail.
 * Só o pedido que VENCE o resgate atômico cria o jogo; um segundo pedido simultâneo da mesma pessoa só espera.
 */
export async function redeemInvite(supabase, { code, user, now = Date.now() }) {
  const row = await findByCode(supabase, code);
  if (!row) return fail("not_found");
  if (row.inviter_id === user.id) return fail("own_invite");

  const state = inviteState(row, now);
  if (state === "expired") return fail("expired");
  if (state === "used" && row.claimed_by !== user.id) return fail("used");

  try {
    const done = async (gameId, duplicate, already) => ({ ok: true, gameId, duplicate, already, game: publicGame(row.game_snapshot), inviter: await getInviterPublic(supabase, row.inviter_id) });

    if (state === "used") {
      // Já resgatado por ESTA pessoa: devolve o mesmo resultado (e conserta o caso raro de o jogo não ter sido criado).
      if (row.claimed_game_id) {
        const d = await describeClaimedGame(supabase, row.claimed_game_id);
        return done(d.gameId, d.duplicate, true);
      }
      const made = await ensureGameFor(supabase, user.id, row.game_snapshot);
      await supabase.from("game_invites").update({ claimed_game_id: made.gameId }).eq("id", row.id).eq("claimed_by", user.id);
      return done(made.gameId, made.duplicate, true);
    }

    // Resgate atômico: só um pedido consegue mudar de 'pending' pra 'claimed'.
    const { data: won } = await supabase.from("game_invites").update({ status: "claimed", claimed_by: user.id, claimed_at: isoNow(now) }).eq("id", row.id).eq("status", "pending").gt("expires_at", isoNow(now)).select("id");
    if (!won || won.length === 0) {
      const { data: again } = await supabase.from("game_invites").select("*").eq("id", row.id).maybeSingle();
      if (!again) return fail("not_found");
      if (again.status === "claimed" && again.claimed_by === user.id) {
        const gameId = again.claimed_game_id || (await waitForClaimedGame(supabase, row.id));
        if (!gameId) return done(null, false, true);
        const d = await describeClaimedGame(supabase, gameId);
        return done(d.gameId, d.duplicate, true);
      }
      return fail(again.status === "claimed" ? "used" : "expired");
    }

    const made = await ensureGameFor(supabase, user.id, row.game_snapshot);
    await supabase.from("game_invites").update({ claimed_game_id: made.gameId }).eq("id", row.id).eq("claimed_by", user.id);
    return done(made.gameId, made.duplicate, false);
  } catch {
    return fail("server");
  }
}
