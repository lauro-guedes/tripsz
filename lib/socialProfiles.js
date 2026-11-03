/** tripsz.social — ler e editar perfis (SÓ no servidor). */
import { BIO_MAX, cleanBio, cleanCity, cleanDisplayName, cleanKinds, commonCount, isAllowedMediaUrl, mutualOf, relationOf, cleanUsername } from "./social";
import { PROFILE_COLS, blockedEither, fail, followGraph, gamesByUsers, lastGameOf, passportStats, profileById, profileByUsername, publicProfile } from "./socialShared";

/** Quantas publicações (kind "post") aparecem pra quem olha: `all` (o dono), `friends` (quem segue: sem "só eu") ou `public`. */
async function postsCount(supabase, id, mode) {
  let q = supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", id).eq("kind", "post").is("deleted_at", null);
  if (mode === "friends") q = q.neq("visibility", "private");
  else if (mode === "public") q = q.eq("visibility", "public");
  const r = await q;
  return r.count || 0;
}

async function counts(supabase, id, mode = "public") {
  const [fr, fg] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", id).eq("status", "accepted"),
    supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", id).eq("status", "accepted"),
  ]);
  return { followers: fr.count || 0, following: fg.count || 0, posts: await postsCount(supabase, id, mode) };
}

/** Estádios (com visitas) e a "jornada" (primeira visita a cada estádio, do mais recente pro mais antigo). */
export function passportLists(games) {
  const byStadium = new Map();
  for (const g of games || []) {
    if (!g.stadium) continue;
    const s = byStadium.get(g.stadium) || { name: g.stadium, city: g.city || null, country: g.country || null, visits: 0, firstDate: null, lastDate: null, firstGame: null };
    s.visits += 1;
    const d = String(g.match_date || "");
    if (!s.firstDate || d < s.firstDate) { s.firstDate = d; s.firstGame = `${g.home_team || "?"} × ${g.away_team || "?"}`; }
    if (!s.lastDate || d > s.lastDate) s.lastDate = d;
    byStadium.set(g.stadium, s);
  }
  const stadiums = [...byStadium.values()].sort((a, b) => b.visits - a.visits || String(b.lastDate).localeCompare(String(a.lastDate))).map(({ name, country, visits, lastDate }) => ({ name, country, visits, lastDate }));
  const journey = [...byStadium.values()].sort((a, b) => String(b.firstDate).localeCompare(String(a.firstDate))).slice(0, 10).map((s) => ({ stadium: s.name, date: s.firstDate, game: s.firstGame }));
  return { stadiums, journey };
}

/** O meu perfil social: os dados editáveis, se já fez o onboarding e os números. */
export async function getMyProfile(supabase, user) {
  const row = await profileById(supabase, user.id);
  if (!row) return fail("not_found");
  const m = user.user_metadata || {};
  const games = (await gamesByUsers(supabase, [user.id])).get(user.id) || [];
  return { ok: true, profile: publicProfile(row, m.avatar_url || m.picture || null), onboarded: !!row.social_onboarded_at, stats: passportStats(games), counts: await counts(supabase, user.id, "all") };
}

/**
 * Edita o MEU perfil. Só mexe no que veio no corpo. Foto de capa/perfil só de lugares permitidos (isAllowedMediaUrl).
 * `isPrivate: false` aprova na hora os pedidos que estavam esperando (não há mais o que aprovar).
 */
export async function updateMyProfile(supabase, user, body, { supabaseUrl, now = Date.now() } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const meta = user.user_metadata || {};
  const patch = {};
  if ("displayName" in b) {
    const v = cleanDisplayName(b.displayName);
    if (!v) return fail("invalid_field", "Informe um nome público de 2 a 40 caracteres.");
    patch.display_name = v;
  }
  if ("bio" in b) {
    if (typeof b.bio !== "string" || b.bio.length > BIO_MAX * 3) return fail("invalid_field", `A bio pode ter até ${BIO_MAX} caracteres.`);
    patch.bio = cleanBio(b.bio) || null;
  }
  for (const [key, col, kind] of [["coverUrl", "cover_url", "cover"], ["avatarUrl", "avatar_url", "avatar"]]) {
    if (!(key in b)) continue;
    if (b[key] === null || b[key] === "") patch[col] = null;
    else if (isAllowedMediaUrl(b[key], kind, { uid: user.id, supabaseUrl, extraAllowed: [meta.avatar_url, meta.picture].filter(Boolean) })) patch[col] = b[key];
    else return fail("invalid_media");
  }
  if ("kinds" in b) patch.profile_kinds = cleanKinds(b.kinds);
  if ("city" in b) patch.city = cleanCity(b.city) || null;
  if ("country" in b) patch.country = cleanCity(b.country) || null;
  if ("isPrivate" in b) {
    if (typeof b.isPrivate !== "boolean") return fail("invalid_field");
    patch.is_private = b.isPrivate;
  }
  if (b.onboarded === true) {
    const cur = await profileById(supabase, user.id);
    if (cur && !cur.social_onboarded_at) patch.social_onboarded_at = new Date(now).toISOString();
  }
  if (Object.keys(patch).length === 0) return getMyProfile(supabase, user);
  patch.updated_at = new Date(now).toISOString();
  const { error } = await supabase.from("profiles").update(patch).eq("user_id", user.id);
  if (error) return fail("server");
  if (patch.is_private === false) await supabase.from("follows").update({ status: "accepted", accepted_at: new Date(now).toISOString() }).eq("followee_id", user.id).eq("status", "pending");
  return getMyProfile(supabase, user);
}

/** O perfil de OUTRA pessoa (ou o meu, pela mesma tela), do jeito que EU posso ver. */
export async function getUserProfile(supabase, viewer, usernameRaw) {
  const username = cleanUsername(usernameRaw);
  if (!username) return fail("invalid_username");
  const row = await profileByUsername(supabase, username);
  if (!row) return fail("not_found");
  const self = row.user_id === viewer.id;
  const block = await blockedEither(supabase, viewer.id);
  if (!self && block.me.has(row.user_id)) return fail("not_found"); // quem me bloqueou "não existe" pra mim
  const blockedByMe = !self && block.byMe.has(row.user_id);
  const [mine, theirs] = await Promise.all([followGraph(supabase, viewer.id), self ? null : followGraph(supabase, row.user_id)]);
  const iFollow = mine.following.includes(row.user_id) ? "accepted" : mine.requested.includes(row.user_id) ? "pending" : null;
  const followsMe = mine.followers.includes(row.user_id) ? "accepted" : null;
  const canSeeContent = self || !row.is_private || iFollow === "accepted";
  const base = { ok: true, profile: publicProfile(row), relation: relationOf({ self, blockedByMe, iFollow, followsMe }), counts: await counts(supabase, row.user_id, self ? "all" : iFollow === "accepted" ? "friends" : "public"), canSeeContent: canSeeContent && !blockedByMe };
  if (self) {
    const m = viewer.user_metadata || {};
    base.profile = publicProfile(row, m.avatar_url || m.picture || null);
    base.counts.friends = mutualOf(new Set(mine.following), new Set(mine.followers)).length; // "42 amigos" (só no meu perfil): quem eu sigo e me segue de volta
  }
  base.mutualCount = canSeeContent && !self && !blockedByMe ? commonCount(new Set(mine.following), new Set(theirs.following)) : 0;
  if (!base.canSeeContent) return { ...base, stats: null, passport: null };
  const games = (await gamesByUsers(supabase, [row.user_id])).get(row.user_id) || [];
  return { ...base, stats: passportStats(games), passport: passportLists(games), lastGame: lastGameOf(games) };
}
