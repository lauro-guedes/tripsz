/**
 * Marcar amigos — peças compartilhadas (SÓ no servidor): erros que a tela entende e leitura dos perfis.
 * Nada aqui devolve id de usuário, e-mail nem sobrenome: só `username` e primeiro nome.
 */
import { firstName } from "./invites";

export const COMPANION_ERRORS = {
  unauthorized: { status: 401, message: "Faça login para continuar." },
  invalid_query: { status: 400, message: "Digite pelo menos 3 caracteres do @ do seu amigo." },
  invalid_usernames: { status: 400, message: "Escolha quem você quer marcar." },
  too_many: { status: 400, message: "Você pode marcar até 10 amigos em um jogo." },
  game_not_found: { status: 404, message: "Jogo não encontrado." },
  not_found: { status: 404, message: "Aviso não encontrado." },
  daily_limit: { status: 429, message: "Você atingiu o limite de marcações de hoje. Tente de novo amanhã." },
  rate_limited: { status: 429, message: "Muitas tentativas. Aguarde um instante e tente de novo." },
  server: { status: 500, message: "Não foi possível concluir agora. Tente de novo." },
};

export const fail = (code) => ({ error: code, ...COMPANION_ERRORS[code] });

const PUBLIC_GAME_FIELDS = ["home_team", "away_team", "home_score", "away_score", "match_date", "stadium", "city", "country", "competition", "home_logo", "away_logo"];
/** Só os campos do jogo que o aviso mostra. */
export const publicGame = (snap) => Object.fromEntries(PUBLIC_GAME_FIELDS.map((k) => [k, snap ? snap[k] ?? null : null]));

const toPublic = (p) => ({ username: p.username, firstName: firstName(p.first_name) || p.username });

/** id do usuário -> { username, firstName } (quem não tem perfil fica de fora). */
export async function profilesByIds(supabase, ids) {
  const out = new Map();
  const list = [...new Set((ids || []).filter(Boolean))];
  if (list.length === 0) return out;
  const { data } = await supabase.from("profiles").select("user_id, username, first_name").in("user_id", list);
  for (const p of data || []) out.set(p.user_id, toPublic(p));
  return out;
}

/** @ -> { id, username, firstName }. O `id` é só pra o servidor: nunca vai pra resposta. */
export async function profilesByHandles(supabase, handles) {
  const out = new Map();
  const list = [...new Set((handles || []).filter(Boolean))];
  if (list.length === 0) return out;
  const { data } = await supabase.from("profiles").select("user_id, username, first_name").in("username", list);
  for (const p of data || []) out.set(p.username, { id: p.user_id, ...toPublic(p) });
  return out;
}
