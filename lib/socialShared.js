/**
 * tripsz.social — peças compartilhadas do servidor: erros que a tela entende, leitura de perfis, estatísticas do Passaporte
 * e relações (seguir/bloquear). Nada aqui devolve e-mail, id de usuário, WhatsApp nem sobrenome separado: só o que o perfil mostra.
 */
import { countryKey } from "./countries";
import { computeTier } from "./fanLevels";
import { totalXp } from "./xpRules";

const ERRORS = {
  unauthorized: [401, "Faça login para continuar."],
  invalid_username: [400, "Esse @ não é válido."],
  not_found: [404, "Perfil não encontrado."],
  self: [400, "Você não pode fazer isso com o seu próprio perfil."],
  blocked: [403, "Você bloqueou esta pessoa. Desbloqueie para continuar."],
  daily_limit: [429, "Você atingiu o limite de hoje. Tente de novo amanhã."],
  rate_limited: [429, "Muitas tentativas. Aguarde um instante e tente de novo."],
  invalid_field: [400, "Confira os dados enviados."],
  invalid_media: [400, "Essa imagem não é permitida."],
  invalid_reason: [400, "Escolha o motivo da denúncia."],
  server: [500, "Não foi possível concluir agora. Tente de novo."],
};
export const fail = (code, message) => ({ error: code, status: ERRORS[code][0], message: message || ERRORS[code][1] });

export const PROFILE_COLS = "user_id, username, first_name, last_name, display_name, bio, cover_url, avatar_url, profile_kinds, is_private, city, country, social_onboarded_at";
export const GAME_COLS = "id, user_id, stadium, country, competition, match_date, created_at, home_team, away_team";

/** Erro de banco NÃO é "não achei": lança, e a rota responde "server" (ex.: o SQL da Fase 1 ainda não foi rodado). */
function must(res) {
  if (res && res.error) throw new Error(res.error.message || "erro de banco");
  return res;
}

/** Roda `fn` e, se o banco falhar, devolve o erro "server" que a tela entende (sem vazar detalhe nenhum). */
export async function guard(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error("[social]", e && e.message);
    return fail("server");
  }
}

const fullName = (r) => [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
export const displayNameOf = (r) => r.display_name || fullName(r) || r.username;

/** O perfil como as TELAS veem (sem ids nem e-mail). `fallbackAvatar`: foto do cadastro (Google), se o perfil ainda não tem. */
export function publicProfile(r, fallbackAvatar = null) {
  return { username: r.username, displayName: displayNameOf(r), avatarUrl: r.avatar_url || fallbackAvatar || null, coverUrl: r.cover_url || null, bio: r.bio || null, kinds: r.profile_kinds || [], isPrivate: !!r.is_private, city: r.city || null, country: r.country || null };
}
export const miniProfile = (r) => ({ username: r.username, displayName: displayNameOf(r), avatarUrl: r.avatar_url || null });

/** As mesmas contas do Passaporte (HomeStats / perfil público). */
export function passportStats(games) {
  const rows = games || [];
  const xp = totalXp(rows);
  return {
    stadiums: new Set(rows.map((g) => g.stadium).filter(Boolean)).size,
    countries: new Set(rows.map((g) => countryKey(g.country)).filter(Boolean)).size,
    games: rows.length,
    competitions: new Set(rows.map((g) => g.competition || "domestica")).size,
    level: computeTier(xp).name,
  };
}

const dateOf = (g) => String(g.match_date || "");
/** Último jogo registrado: { stadium, date } ou null. */
export function lastGameOf(games) {
  const last = [...(games || [])].sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
  return last ? { stadium: last.stadium || null, date: last.match_date || null } : null;
}

export async function profileByUsername(supabase, username) {
  const { data } = must(await supabase.from("profiles").select(PROFILE_COLS).eq("username", username).maybeSingle());
  return data || null;
}
export async function profileById(supabase, id) {
  const { data } = must(await supabase.from("profiles").select(PROFILE_COLS).eq("user_id", id).maybeSingle());
  return data || null;
}
export async function profilesByIds(supabase, ids) {
  const out = new Map();
  const list = [...new Set((ids || []).filter(Boolean))];
  if (list.length === 0) return out;
  const { data } = must(await supabase.from("profiles").select(PROFILE_COLS).in("user_id", list));
  for (const r of data || []) out.set(r.user_id, r);
  return out;
}
/** user_id -> jogos (só as colunas necessárias). */
export async function gamesByUsers(supabase, ids) {
  const out = new Map();
  const list = [...new Set((ids || []).filter(Boolean))];
  if (list.length === 0) return out;
  const { data } = must(await supabase.from("attended_games").select(GAME_COLS).in("user_id", list));
  for (const g of data || []) (out.get(g.user_id) || out.set(g.user_id, []).get(g.user_id)).push(g);
  return out;
}

/** Quem eu sigo / quem me segue (aceitos) e os pedidos. Ordenados do mais novo pro mais antigo. */
export async function followGraph(supabase, userId) {
  const [out, inc] = await Promise.all([
    supabase.from("follows").select("followee_id, status, created_at").eq("follower_id", userId).order("created_at", { ascending: false }).limit(5000),
    supabase.from("follows").select("follower_id, status, created_at").eq("followee_id", userId).order("created_at", { ascending: false }).limit(5000),
  ]);
  must(out);
  must(inc);
  const outRows = out.data || [];
  const inRows = inc.data || [];
  return {
    following: outRows.filter((r) => r.status === "accepted").map((r) => r.followee_id),
    requested: outRows.filter((r) => r.status === "pending").map((r) => r.followee_id),
    followers: inRows.filter((r) => r.status === "accepted").map((r) => r.follower_id),
    requestsIn: inRows.filter((r) => r.status === "pending").map((r) => r.follower_id),
  };
}

/** Todo mundo com quem há bloqueio em QUALQUER sentido (some das listas e das buscas). */
export async function blockedEither(supabase, userId) {
  const [mine, theirs] = await Promise.all([supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId), supabase.from("user_blocks").select("blocker_id").eq("blocked_id", userId)]);
  must(mine);
  must(theirs);
  return { byMe: new Set((mine.data || []).map((r) => r.blocked_id)), me: new Set((theirs.data || []).map((r) => r.blocker_id)) };
}
