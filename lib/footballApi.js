/**
 * Cliente para a API-Football (https://www.api-football.com/documentation-v3).
 * Usado SÓ no servidor (rotas de API) — nunca no navegador, porque a
 * FOOTBALL_API_KEY é secreta e o plano gratuito só permite 100
 * requisições por dia, então cada chamada precisa ser intencional.
 */
const BASE_URL = "https://v3.football.api-sports.io";

async function footballFetch(path, params = {}) {
  const url = new URL(BASE_URL + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY },
    // A API-Football muda pouco durante o dia; cache curto evita
    // gastar requisições repetidas à toa em poucos minutos.
    next: { revalidate: 3600 },
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
 * Busca ligas por nome de país. Use isso UMA VEZ por país pra descobrir o
 * "id" real de cada liga, depois guarde esses IDs na tabela `leagues` do
 * Supabase — não fique chamando isso toda hora, cada chamada conta na cota.
 */
export async function searchLeaguesByCountry(country) {
  return footballFetch("/leagues", { search: country });
}

/**
 * Busca os jogos de uma liga numa temporada, num período de datas.
 * `from`/`to` no formato YYYY-MM-DD.
 */
export async function getFixtures({ leagueId, season, from, to }) {
  return footballFetch("/fixtures", { league: leagueId, season, from, to });
}

/**
 * Busca uma liga específica pelo ID (útil pra conferir nome/temporada
 * atual antes de gravar no Supabase).
 */
export async function getLeagueById(leagueId) {
  return footballFetch("/leagues", { id: leagueId });
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

/**
 * Busca os jogos que aconteceram num estádio específico, numa temporada.
 */
export async function getFixturesByVenueSeason(venueId, season) {
  return footballFetch("/fixtures", { venue: venueId, season });
}
