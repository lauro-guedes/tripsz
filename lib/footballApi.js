/**
 * Cliente para a API-Football (https://www.api-football.com/documentation-v3).
 * Usado SÓ no servidor (rotas de API) — nunca no navegador, porque a
 * FOOTBALL_API_KEY é secreta. Cada chamada gasta cota do plano,
 * então só chame quando for preciso (os resultados ficam em cache).
 */
const BASE_URL = "https://v3.football.api-sports.io";

async function footballFetch(path, params = {}) {
  const url = new URL(BASE_URL + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY },
    // Times, estádios e resultados de temporadas já encerradas (2022-2024)
    // praticamente nunca mudam — um cache de 7 dias evita gastar cota
    // repetindo a mesma busca (ex: "Arsenal" ou "Anfield") toda hora.
    next: { revalidate: 604800 },
  });

  const data = await res.json();

  if (!res.ok || (data.errors && Object.keys(data.errors).length > 0)) {
    throw new Error(
      `API-Football error: ${res.status} ${JSON.stringify(data.errors || data)}`
    );
  }

  // A API sempre devolve quantas requisições restam no dia — vale logar
  // isso, já que no plano grátis são só 100/dia.
  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  if (remaining !== null) {
    console.log(`[API-Football] requisições restantes hoje: ${remaining}`);
  }

  return data.response;
}

/**
 * Busca um time pelo nome (ex: "Palmeiras") e devolve o id e o logo
 * oficial da API-Football — usado pra corrigir/confirmar o mapeamento de
 * escudos do app, e também pra achar o time no fluxo de "Adicionar jogo
 * do passado".
 */
export async function searchTeams(name) {
  return footballFetch("/teams", { search: name });
}

/**
 * Busca estádios pelo nome (ex: "Emirates") — usado no fluxo de
 * "Registrar Jogo", que agora busca por estádio em vez de time.
 */
export async function searchVenues(name) {
  return footballFetch("/venues", { search: name });
}
