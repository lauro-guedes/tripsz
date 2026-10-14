/**
 * Avisos "Fulano te marcou em [jogo]" (SÓ no servidor): quem foi marcado decide.
 *  - "Adicionar ao meu Passaporte": o jogo entra na conta dele (sem duplicar).
 *  - "Ignorar": nada entra, e quem marcou não é avisado.
 * Nada entra em conta alheia sem esse aceite, então não dá pra inflar o XP ou o ranking de outra pessoa.
 */
import { fail, profilesByIds, publicGame } from "./companionShared";
import { ensureGameFor, isoNow } from "./inviteShared";

export async function listCompanionRequests(supabase, { user }) {
  const { data, error } = await supabase.from("game_companions").select("id, tagger_id, game_snapshot, created_at").eq("companion_id", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(20);
  if (error) return fail("server");
  const rows = data || [];
  const taggers = await profilesByIds(supabase, rows.map((r) => r.tagger_id));
  return {
    ok: true,
    requests: rows.map((r) => ({ id: r.id, createdAt: r.created_at, tagger: taggers.get(r.tagger_id) || { firstName: "Um amigo", username: null }, game: publicGame(r.game_snapshot) })),
  };
}

async function findMine(supabase, requestId, userId) {
  const { data } = await supabase.from("game_companions").select("*").eq("id", requestId).eq("companion_id", userId).maybeSingle();
  return data || null;
}

/** action: "accept" | "ignore". Idempotente: repetir devolve o mesmo resultado. */
export async function respondToRequest(supabase, { user, requestId, action, now = Date.now() }) {
  const row = await findMine(supabase, requestId, user.id);
  if (!row) return fail("not_found");

  if (action === "ignore") {
    if (row.status === "accepted") return { ok: true, status: "accepted", gameId: row.accepted_game_id }; // já aceito: não desfaz
    await supabase.from("game_companions").update({ status: "ignored", responded_at: isoNow(now) }).eq("id", row.id).eq("status", "pending");
    return { ok: true, status: "ignored" };
  }

  if (row.status === "ignored") return fail("not_found"); // já ignorou: o aviso não existe mais pra ela
  try {
    if (row.status === "pending") {
      const { data: won } = await supabase.from("game_companions").update({ status: "accepted", responded_at: isoNow(now) }).eq("id", row.id).eq("status", "pending").select("id");
      if (!won || won.length === 0) {
        const again = await findMine(supabase, requestId, user.id); // outro pedido ganhou
        if (!again || again.status === "ignored") return fail("not_found");
        return { ok: true, status: "accepted", already: true, gameId: again.accepted_game_id };
      }
      const made = await ensureGameFor(supabase, user.id, row.game_snapshot);
      await supabase.from("game_companions").update({ accepted_game_id: made.gameId }).eq("id", row.id).eq("companion_id", user.id);
      return { ok: true, status: "accepted", already: false, gameId: made.gameId, duplicate: made.duplicate };
    }
    // já aceito antes: devolve o mesmo (e conserta o caso raro de o jogo não ter sido criado)
    if (row.accepted_game_id) return { ok: true, status: "accepted", already: true, gameId: row.accepted_game_id };
    const made = await ensureGameFor(supabase, user.id, row.game_snapshot);
    await supabase.from("game_companions").update({ accepted_game_id: made.gameId }).eq("id", row.id).eq("companion_id", user.id);
    return { ok: true, status: "accepted", already: true, gameId: made.gameId, duplicate: made.duplicate };
  } catch {
    return fail("server");
  }
}
