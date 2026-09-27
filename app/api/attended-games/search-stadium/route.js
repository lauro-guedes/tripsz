import { searchVenues, searchTeams } from "@/lib/footballApi";

// Testamos ao vivo: a busca de ESTÁDIO da API-Football (/venues) não
// acha vários apelidos populares (Anfield, Old Trafford, San Siro,
// Wanda Metropolitano, Signal Iduna Park...), mesmo eles existindo na
// base. Só que a busca de TIME (/teams) sempre devolve o estádio junto
// — inclusive com esse mesmo apelido. Então, pros casos mais famosos,
// resolvemos o estádio through o time que joga nele, em vez de tentar
// achar o nome exato que a busca de estádio aceita.
const STADIUM_NICKNAME_TO_TEAM = {
  "anfield": "Liverpool",
  "old trafford": "Manchester United",
  "san siro": "Inter",
  "giuseppe meazza": "Inter",
  "wanda metropolitano": "Atletico Madrid",
  "metropolitano": "Atletico Madrid",
  "signal iduna park": "Borussia Dortmund",
  "westfalenstadion": "Borussia Dortmund",
  "mineirao": "Cruzeiro",
  "mineirão": "Cruzeiro",
  "itaquerao": "Corinthians",
  "itaquerão": "Corinthians",
  "ali sami yen": "Galatasaray",
};

async function footballFetchRaw(path, params) {
  const url = new URL("https://v3.football.api-sports.io" + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY } });
  const data = await res.json();
  if (!res.ok || (data.errors && Object.keys(data.errors).length > 0)) {
    throw new Error(`API-Football error: ${res.status} ${JSON.stringify(data.errors || data)}`);
  }
  return data.response;
}

function mapGames(fixtures) {
  return fixtures.map((f) => ({
    apiFixtureId: f.fixture.id,
    home: f.teams.home.name,
    away: f.teams.away.name,
    homeLogo: f.teams.home.logo,
    awayLogo: f.teams.away.logo,
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    date: f.fixture.date,
    competition: f.league.name,
    country: f.league.country,
  }));
}

// Acha o estádio e o time através do nome do time — usado pros apelidos
// conhecidos, e como último recurso caso a busca direta não ache nada.
async function venueFromTeamName(teamName) {
  const teams = await searchTeams(teamName);
  const best = teams?.find((t) => t.team.name.toLowerCase() === teamName.toLowerCase()) || teams?.[0];
  if (!best?.venue) return null;
  return { venue: best.venue, teamId: best.team.id };
}

// Dado só o estádio (sem saber ainda qual time joga lá), pergunta pra
// própria API-Football quais times têm esse estádio como casa.
async function teamIdsForVenue(venueId) {
  const teams = await footballFetchRaw("/teams", { venue: venueId });
  return teams.map((t) => t.team.id).slice(0, 2); // no máx. 2 (estádios compartilhados, tipo San Siro)
}

/**
 * GET /api/attended-games/search-stadium?stadium=Emirates&season=2024
 *
 * Fluxo de "Registrar Jogo": busca por ESTÁDIO em vez de time.
 *
 * A busca traz TODOS os jogos que o time mandante disputou naquele
 * estádio na temporada — de qualquer competição (liga, copa nacional,
 * Champions League etc), não só de uma liga fixa. Pra isso, filtramos
 * `/fixtures` por `team` + `venue` + `season` juntos (a API não aceita
 * `venue` sozinho, confirmado testando ao vivo — sempre precisa vir
 * junto de outro parâmetro como team ou league).
 *
 * 1. Se o nome digitado for um apelido conhecido (Anfield, San Siro...),
 *    já sai sabendo o time e o estádio.
 * 2. Senão, busca o estádio pelo nome direto (searchVenues, até 3
 *    resultados) e, pra cada um, pergunta pra API quais times jogam lá.
 * 3. Se nada disso achar nada, tenta uma última vez tratando o texto
 *    digitado como nome de time (caso a pessoa tenha digitado o time
 *    por engano ou hábito).
 *
 * Devolve { found: false } com um motivo se nada funcionar — o app cai
 * no formulário manual nesse caso.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawStadium = searchParams.get("stadium")?.trim();
  const season = parseInt(searchParams.get("season"), 10);

  if (!rawStadium) {
    return Response.json({ error: "Informe o nome do estádio." }, { status: 400 });
  }
  if (!season || season < 2022 || season > 2024) {
    return Response.json({ error: "Escolha um ano entre 2022 e 2024." }, { status: 400 });
  }

  try {
    // Monta a lista de estádios candidatos, cada um já com o(s) time(s)
    // conhecido(s) quando possível, na ordem de prioridade.
    let candidates = [];

    const nicknameTeam = STADIUM_NICKNAME_TO_TEAM[rawStadium.toLowerCase()];
    if (nicknameTeam) {
      const r = await venueFromTeamName(nicknameTeam);
      if (r) candidates.push(r);
    }

    const directVenues = await searchVenues(rawStadium);
    directVenues.slice(0, 3).forEach((v) => candidates.push({ venue: v, teamId: null }));

    if (candidates.length === 0) {
      // Último recurso: talvez a pessoa tenha digitado o nome de um time.
      const r = await venueFromTeamName(rawStadium);
      if (r) candidates.push(r);
    }

    if (candidates.length === 0) {
      return Response.json({ found: false, reason: "estadio_nao_encontrado" });
    }

    let matchedVenue = null;
    let games = [];
    let lastVenueTried = candidates[0].venue;

    for (const { venue, teamId } of candidates) {
      lastVenueTried = venue;

      const teamIds = teamId ? [teamId] : await teamIdsForVenue(venue.id);
      if (teamIds.length === 0) continue;

      const seen = new Set();
      const allFixtures = [];
      for (const tid of teamIds) {
        const fixtures = await footballFetchRaw("/fixtures", { team: tid, venue: venue.id, season });
        for (const f of fixtures) {
          if (!seen.has(f.fixture.id)) {
            seen.add(f.fixture.id);
            allFixtures.push(f);
          }
        }
      }

      if (allFixtures.length > 0) {
        matchedVenue = venue;
        games = mapGames(allFixtures);
        break;
      }
    }

    if (!matchedVenue) {
      return Response.json({ found: false, reason: "sem_jogos_no_periodo", venue: lastVenueTried });
    }

    return Response.json({
      found: true,
      venue: { id: matchedVenue.id, name: matchedVenue.name, city: matchedVenue.city, country: matchedVenue.country, capacity: matchedVenue.capacity },
      games,
    });
  } catch (e) {
    console.error("Erro em /api/attended-games/search-stadium:", e);
    return Response.json({ error: e.message || "Não foi possível buscar os jogos." }, { status: 500 });
  }
}
