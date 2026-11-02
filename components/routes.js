"use client";

// Cada passo da jornada tem seu próprio endereço na barra do navegador —
// isso faz o botão voltar/avançar do navegador funcionar de verdade, e
// deixa visível em que momento da jornada a pessoa está.
export const SCREEN_TO_PATH = {
  landing: "/",
  criarconta: "/criar-conta",
  assinar: "/assinar",
  account: "/comecar",
  destino: "/roteiro/destino",
  times: "/roteiro/times",
  datas: "/roteiro/datas",
  pessoas: "/roteiro/pessoas",
  preferencias: "/roteiro/preferencias",
  loading: "/roteiro/calculando",
  resultado: "/roteiro/resultado",
  checkout: "/checkout",
  roteiros: "/conta/roteiros",
  roteiro: "/conta/roteiros/detalhe",
  jogos: "/conta/jogos",
  "bem-vindo": "/conta/bem-vindo",
  acompanhantes: "/conta/jogos/acompanhantes",
  "jogo-salvo": "/conta/jogos/salvo",
  buscar: "/conta/buscar-jogos",
  calendario: "/conta/calendario",
  "registrar-jogo": "/conta/jogos/registrar",
  nivel: "/conta/nivel",
  conquistas: "/conta/conquistas",
  perfil: "/conta/perfil",
  "perfil-editar": "/conta/perfil/editar",
  "perfil-dados": "/conta/perfil/dados",
  amigos: "/conta/amigos",
  notificacoes: "/conta/notificacoes",
  assinatura: "/conta/assinatura",
  ranking: "/conta/ranking",
};

export const PATH_TO_SCREEN = Object.fromEntries(Object.entries(SCREEN_TO_PATH).map(([k, v]) => [v, k]));

// O perfil de OUTRA pessoa leva o @ no endereço (/conta/usuario/ana.santos): dá pra dar F5 e compartilhar o link.
export const USER_PATH_PREFIX = "/conta/usuario/";
const USER_PATH = /^\/conta\/usuario\/([a-z0-9][a-z0-9._]{1,18}[a-z0-9])\/?$/;

/** Endereço de uma tela. `viewUser`: o @ do perfil aberto (só vale na tela "usuario"). */
export function pathForScreen(screen, viewUser) {
  if (screen === "usuario") return viewUser ? `${USER_PATH_PREFIX}${viewUser}` : SCREEN_TO_PATH.perfil;
  return SCREEN_TO_PATH[screen] || "/";
}

/** Tela (e @, se for o perfil de alguém) de um endereço. `screen` é null se o endereço não é de nenhuma tela. */
export function screenFromPath(pathname) {
  const m = USER_PATH.exec(String(pathname || "").toLowerCase());
  if (m && !/[._]{2}/.test(m[1])) return { screen: "usuario", viewUser: m[1] }; // o banco não aceita dois pontos/underlines seguidos
  return { screen: PATH_TO_SCREEN[pathname] || null, viewUser: null };
}
