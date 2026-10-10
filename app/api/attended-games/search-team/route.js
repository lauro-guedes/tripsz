import { searchTeams } from "@/lib/footballApi";
import { isValidSeason, MIN_SEASON, maxSeason, friendlySeasonError } from "@/lib/seasons";
import { ensureLogoCached } from "@/lib/teamLogos";
import { toApiCountryName } from "@/lib/countries";

export const dynamic = "force-dynamic";

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

// Cacheia o escudo de TODOS os times que aparecem nos resultados (o
// clube buscado e cada adversário), não só o principal — antes disso,
// só o clube buscado tinha escudo confiável, e os adversários dependiam
// direto do CDN da API-Football, que às vezes falha.
async function cacheGameLogos(games) {
  const urlByTeamId = new Map();
  games.forEach((g) => {
    if (g.homeTeamId) urlByTeamId.set(g.homeTeamId, g.homeLogo);
    if (g.awayTeamId) urlByTeamId.set(g.awayTeamId, g.awayLogo);
  });
  const cachedUrlByTeamId = new Map();
  for (const [teamId, url] of urlByTeamId) {
    cachedUrlByTeamId.set(teamId, await ensureLogoCached(teamId, url));
  }
  return games.map((g) => ({
    ...g,
    homeLogo: cachedUrlByTeamId.get(g.homeTeamId) || g.homeLogo,
    awayLogo: cachedUrlByTeamId.get(g.awayTeamId) || g.awayLogo,
  }));
}

/**
 * GET /api/attended-games/search-team?team=Arsenal&season=2024
 *
 * Fluxo de "Registrar Jogo" pela aba CLUBE — busca por time em vez de
 * estádio. Isso traz TODOS os jogos do time na temporada (qualquer
 * competição, qualquer estádio, incluindo jogos fora de casa), sem
 * nenhum dos problemas de cruzamento de dados que a busca por estádio
 * tem (times/estádios às vezes vêm com cadastro inconsistente na
 * API-Football).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawTeam = searchParams.get("team")?.trim();
  const season = parseInt(searchParams.get("season"), 10);
  const mode = searchParams.get("mode");

  if (!rawTeam) {
    return Response.json({ error: mode === "selecao" ? "Informe o nome de uma seleção." : "Informe o nome do clube." }, { status: 400 });
  }
  if (!isValidSeason(season)) {
    return Response.json({ error: `Escolha uma temporada entre ${MIN_SEASON} e ${maxSeason()}.` }, { status: 400 });
  }

  try {
    const searchQuery = mode === "selecao" ? toApiCountryName(rawTeam) : rawTeam;
    const rawTeams = await searchTeams(searchQuery);
    const teams = mode === "selecao" ? (rawTeams || []).filter((t) => t.team.national === true) : rawTeams;
    if (!teams || teams.length === 0) {
      return Response.json({ found: false, reason: mode === "selecao" ? "selecao_nao_encontrada" : "clube_nao_encontrado" });
    }
    const best = teams.find((t) => t.team.name.toLowerCase() === searchQuery.toLowerCase()) || teams[0];

    const allFixtures = await footballFetchRaw("/fixtures", { team: best.team.id, season });
    // Só jogos que já começaram: dá pra registrar que você foi, não um jogo que ainda vai acontecer.
    const nowMs = Date.now();
    const fixtures = allFixtures.filter((f) => new Date(f.fixture.date).getTime() <= nowMs);
    if (fixtures.length === 0) {
      return Response.json({ found: false, reason: "sem_jogos_no_periodo" });
    }

    // Cacheia o escudo do próprio clube buscado (os adversários ficam
    // cacheados sozinhos na hora de salvar, como já fazemos).
    const clubLogo = await ensureLogoCached(best.team.id, best.team.logo);

    const games = fixtures.map((f) => ({
      apiFixtureId: f.fixture.id,
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeTeamId: f.teams.home.id,
      awayTeamId: f.teams.away.id,
      homeLogo: f.teams.home.logo,
      awayLogo: f.teams.away.logo,
      homeScore: f.goals.home,
      awayScore: f.goals.away,
      date: f.fixture.date,
      competition: f.league.name,
      country: f.league.country,
      stadium: f.fixture.venue?.name || null,
      city: f.fixture.venue?.city || null,
    }));
    games.sort((a, b) => new Date(a.date) - new Date(b.date));
    const cachedGames = await cacheGameLogos(games);

    return Response.json({
      found: true,
      club: { id: best.team.id, name: best.team.name, city: best.venue?.city || null, country: best.team.country, logo: clubLogo },
      games: cachedGames,
    });
  } catch (e) {
    console.error("Erro em /api/attended-games/search-team:", e);
    const friendly = friendlySeasonError(e.message);
    if (friendly) return Response.json({ error: friendly }, { status: 400 });
    return Response.json({ error: e.message || "Não foi possível buscar os jogos." }, { status: 500 });
  }
}
