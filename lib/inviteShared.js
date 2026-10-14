/**
 * Convites de jogo — peças compartilhadas (SÓ no servidor): erros que a tela entende, dados mínimos de quem
 * convidou e a criação do jogo no Passaporte do convidado. Usadas por inviteServer.js e inviteRedeem.js.
 */
import { firstName } from "./invites";

/** Erros que a tela entende: code + status HTTP + frase em português. */
export const INVITE_ERRORS = {
  unauthorized: { status: 401, message: "Faça login para continuar." },
  invalid_channel: { status: 400, message: "Escolha como enviar o convite." },
  invalid_name: { status: 400, message: "Informe o nome de quem você quer convidar." },
  invalid_game: { status: 400, message: "Este jogo não tem os dados mínimos para virar um convite." },
  game_not_found: { status: 404, message: "Jogo não encontrado." },
  not_found: { status: 404, message: "Convite não encontrado." },
  own_invite: { status: 403, message: "Este é o seu próprio convite. Envie o link para quem foi com você." },
  used: { status: 409, message: "Este convite já foi resgatado." },
  expired: { status: 410, message: "Este convite expirou." },
  daily_limit: { status: 429, message: "Você atingiu o limite de convites de hoje. Tente de novo amanhã." },
  rate_limited: { status: 429, message: "Muitas tentativas. Aguarde um instante e tente de novo." },
  conflict: { status: 409, message: "Este convite já foi trocado por um novo." },
  server: { status: 500, message: "Não foi possível concluir agora. Tente de novo." },
};

export const fail = (code) => ({ error: code, ...INVITE_ERRORS[code] });


export const isoNow = (now) => new Date(now).toISOString();

/* ---------- quem convidou (dados públicos mínimos) ---------- */

/**
 * `profiles` (supabase-profiles-username.sql): user_id, username (único), first_name, last_name.
 * Só o primeiro nome e o @ saem daqui; o sobrenome nunca é lido.
 */
export async function readProfile(supabase, userId) {
  try {
    const { data, error } = await supabase.from("profiles").select("username, first_name").eq("user_id", userId).maybeSingle();
    if (!error && data) return data;
  } catch {
    // sem perfil: cai no nome do cadastro
  }
  return null;
}

/** { firstName, username } — nunca sobrenome, e-mail ou telefone. */
export async function getInviterPublic(supabase, userId) {
  const profile = await readProfile(supabase, userId);
  let name = firstName((profile && profile.first_name) || "");
  if (!name) {
    try {
      const { data } = await supabase.auth.admin.getUserById(userId);
      name = firstName((data && data.user && data.user.user_metadata && data.user.user_metadata.name) || "");
    } catch {
      // sem nome: a tela mostra "Um amigo"
    }
  }
  return { firstName: name || "Um amigo", username: (profile && profile.username) || null };
}

/* ---------- jogo do convidado ---------- */

export async function findDuplicateGame(supabase, userId, snap) {
  if (snap.api_fixture_id) {
    const { data } = await supabase.from("attended_games").select("id").eq("user_id", userId).eq("api_fixture_id", snap.api_fixture_id).limit(1);
    if (data && data.length) return data[0].id;
  }
  if (snap.match_date && snap.home_team && snap.away_team) {
    const { data } = await supabase.from("attended_games").select("id").eq("user_id", userId).eq("match_date", snap.match_date).eq("home_team", snap.home_team).eq("away_team", snap.away_team).limit(1);
    if (data && data.length) return data[0].id;
  }
  return null;
}

/** Guarda o jogo no Passaporte do convidado (sem duplicar). Devolve { gameId, duplicate }. */
export async function ensureGameFor(supabase, userId, snap) {
  const existing = await findDuplicateGame(supabase, userId, snap);
  if (existing) return { gameId: existing, duplicate: true };
  const { data, error } = await supabase
    .from("attended_games")
    .insert({
      user_id: userId,
      source: "invite",
      api_fixture_id: snap.api_fixture_id,
      home_team: snap.home_team,
      away_team: snap.away_team,
      match_date: snap.match_date,
      stadium: snap.stadium,
      city: snap.city,
      country: snap.country || "",
      competition: snap.competition,
      home_logo: snap.home_logo,
      away_logo: snap.away_logo,
      home_score: snap.home_score,
      away_score: snap.away_score,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("insert_game_failed");
  return { gameId: data.id, duplicate: false };
}
