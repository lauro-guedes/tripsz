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
  buscar: "/conta/buscar-jogos",
  calendario: "/conta/calendario",
  "registrar-jogo": "/conta/jogos/registrar",
  nivel: "/conta/nivel",
  conquistas: "/conta/conquistas",
  perfil: "/conta/perfil",
  assinatura: "/conta/assinatura",
  ranking: "/conta/ranking",
};

export const PATH_TO_SCREEN = Object.fromEntries(Object.entries(SCREEN_TO_PATH).map(([k, v]) => [v, k]));
