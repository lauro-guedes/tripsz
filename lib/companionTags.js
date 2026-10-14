/**
 * Marcar quem foi com você, e o que o DONO do jogo enxerga (SÓ no servidor).
 * Quem é marcado recebe um AVISO (não o jogo): ver companionRequests.js.
 */
import { DAILY_TAG_LIMIT, MAX_COMPANIONS, normalizeHandle, personState } from "./companions";
import { fail, profilesByHandles, profilesByIds } from "./companionShared";
import { gameSnapshot, inviteListStatus } from "./invites";

async function dailyCount(supabase, taggerId, now) {
  const since = new Date(now - 24 * 3600 * 1000).toISOString();
  const { count, error } = await supabase.from("game_companions").select("id", { count: "exact", head: true }).eq("tagger_id", taggerId).gte("created_at", since);
  if (error) throw new Error("count_failed");
  return count || 0;
}

/** Todos os marcados de um jogo, como o dono vê (sem ids). */
async function currentPeople(supabase, gameId) {
  const { data } = await supabase.from("game_companions").select("companion_id, status").eq("attended_game_id", gameId);
  const rows = data || [];
  const profiles = await profilesByIds(supabase, rows.map((r) => r.companion_id));
  return rows.map((r) => (profiles.has(r.companion_id) ? { ...profiles.get(r.companion_id), state: personState(r.status) } : null)).filter(Boolean);
}

/** Marca amigos (por @) num jogo DA PESSOA. Cada um vira um aviso "aguardando aceite". */
export async function tagCompanions(supabase, { user, gameId, usernames, now = Date.now() }) {
  if (!Array.isArray(usernames)) return fail("invalid_usernames");
  const handles = [...new Set(usernames.map(normalizeHandle).filter(Boolean))];
  if (handles.length === 0) return fail("invalid_usernames");
  if (handles.length > MAX_COMPANIONS) return fail("too_many");

  const { data: game, error } = await supabase.from("attended_games").select("*").eq("id", gameId).eq("user_id", user.id).maybeSingle();
  if (error) return fail("server");
  if (!game) return fail("game_not_found");
  const snap = gameSnapshot(game);
  if (!snap.home_team || !snap.away_team || !snap.match_date) return fail("game_not_found");

  try {
    const found = await profilesByHandles(supabase, handles);
    const unknown = handles.filter((h) => !found.has(h));
    const candidates = handles.filter((h) => found.has(h) && found.get(h).id !== user.id);
    const { data: existing } = await supabase.from("game_companions").select("companion_id").eq("attended_game_id", game.id);
    const already = new Set((existing || []).map((r) => r.companion_id));
    const toAdd = candidates.filter((h) => !already.has(found.get(h).id));
    if (already.size + toAdd.length > MAX_COMPANIONS) return fail("too_many");
    if (toAdd.length > 0 && (await dailyCount(supabase, user.id, now)) + toAdd.length > DAILY_TAG_LIMIT) return fail("daily_limit");

    const tagged = [];
    for (const h of toAdd) {
      const p = found.get(h);
      const { error: insErr } = await supabase.from("game_companions").insert({ attended_game_id: game.id, tagger_id: user.id, companion_id: p.id, status: "pending", game_snapshot: snap });
      if (insErr && insErr.code !== "23505") throw new Error("insert_failed"); // 23505 = já marcado (disputa): tudo bem
      if (!insErr) tagged.push({ username: p.username, firstName: p.firstName, state: "waiting" });
    }
    return { ok: true, tagged, unknown, people: await currentPeople(supabase, game.id) };
  } catch {
    return fail("server");
  }
}

/**
 * Pra tela Meus Jogos: de cada jogo da pessoa, quem foi com ela ("people") e os convites ainda sem resposta ("invites").
 * Quem resgatou um convite conta como acompanhante. Quem IGNOROU a marcação aparece como "aguardando" (sem avisar quem marcou).
 */
export async function listCompanionsForGames(supabase, { user, now = Date.now() }) {
  const [tags, invs] = await Promise.all([
    supabase.from("game_companions").select("attended_game_id, companion_id, status").eq("tagger_id", user.id).limit(1000),
    supabase.from("game_invites").select("id, attended_game_id, invitee_name, channel, status, expires_at, claimed_by, created_at").eq("inviter_id", user.id).neq("status", "revoked").order("created_at", { ascending: true }).limit(1000),
  ]);
  if (tags.error || invs.error) return fail("server");
  const tagRows = tags.data || [];
  const invRows = (invs.data || []).filter((r) => r.attended_game_id);
  const profiles = await profilesByIds(supabase, [...tagRows.map((r) => r.companion_id), ...invRows.map((r) => r.claimed_by)]);

  const games = {};
  const slot = (id) => (games[id] ||= { people: [], invites: [] });
  const addPerson = (gameId, p, state) => {
    const list = slot(gameId).people;
    const same = list.find((x) => x.username === p.username);
    if (!same) list.push({ ...p, state });
    else if (state === "accepted") same.state = "accepted";
  };
  for (const r of tagRows) if (profiles.has(r.companion_id)) addPerson(r.attended_game_id, profiles.get(r.companion_id), personState(r.status));
  for (const r of invRows) {
    if (r.status === "claimed") {
      if (profiles.has(r.claimed_by)) addPerson(r.attended_game_id, profiles.get(r.claimed_by), "accepted");
    } else {
      slot(r.attended_game_id).invites.push({ id: r.id, inviteeName: r.invitee_name, channel: r.channel, status: inviteListStatus(r, now), expiresAt: r.expires_at });
    }
  }
  return { ok: true, games };
}
