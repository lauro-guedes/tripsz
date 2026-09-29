import { searchVenues, searchTeams } from "@/lib/footballApi";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const TEAM_LOGO_BUCKET_URL = "https://aswxlrabhyzblyliyvjn.supabase.co/storage/v1/object/public/team-logos";

// Testamos ao vivo: a busca de ESTÁDIO da API-Football (/venues) não
// acha vários apelidos populares (Anfield, Old Trafford, San Siro,
// Morumbi...), mesmo eles existindo na base. Só que a busca de TIME
// (/teams) sempre devolve o estádio junto — inclusive com esse mesmo
// apelido. Então, pros casos mais famosos, resolvemos o TIME que joga
// lá, em vez de tentar achar o nome exato do estádio.
// Ligas principais de cada país — usado como último recurso quando um
// estádio não tem um time-âncora confiável (estádios neutros/multiuso,
// tipo estádios nacionais que recebem vários clubes diferentes, sem
// "dono" fixo). Nesse caso, buscamos direto por estádio + liga, sem
// precisar de time nenhum.
// Os IDs marcados "a confirmar" foram preenchidos de memória (não
// testados ao vivo ainda) — se um deles estiver errado, o pior caso é
// simplesmente não achar jogos extra por essa liga, nunca um dado errado.
const MAIN_LEAGUES_BY_COUNTRY = {
  England: [39], // Premier League — confirmado
  Spain: [140], // La Liga — confirmado
  Italy: [135], // Serie A — confirmado
  Germany: [78], // Bundesliga — confirmado
  France: [61], // Ligue 1 — confirmado
  Brazil: [71, 72], // Série A, Série B — 71 confirmado ao vivo; 72 a confirmar
  Portugal: [94], // Primeira Liga — a confirmar
  Netherlands: [88], // Eredivisie — a confirmar
  Turkey: [203], // Süper Lig — a confirmar
  Argentina: [128], // Liga Profesional — a confirmar
  Uruguay: [268], // Primera División — a confirmar
  Chile: [265], // Primera División — a confirmar
  Colombia: [239], // Primera A — a confirmar
};

const STADIUM_NICKNAME_TO_TEAM = {
  "anfield": "Liverpool",
  "old trafford": "Manchester United",
  "stamford bridge": "Chelsea",
  "etihad stadium": "Manchester City",
  "etihad": "Manchester City",
  "wanda metropolitano": "Atletico Madrid",
  "metropolitano": "Atletico Madrid",
  "ramon sanchez-pizjuan": "Sevilla",
  "sanchez pizjuan": "Sevilla",
  "san siro": "Inter",
  "giuseppe meazza": "Inter",
  "stadio olimpico": "Roma",
  "signal iduna park": "Borussia Dortmund",
  "westfalenstadion": "Borussia Dortmund",
  "allianz arena": "Bayern München",
  "velodrome": "Marseille",
  "orange velodrome": "Marseille",
  "estadio da luz": "Benfica",
  "estadio do dragao": "Porto",
  "johan cruyff arena": "Ajax",
  "amsterdam arena": "Ajax",
  "de kuip": "Feyenoord",
  "ali sami yen": "Galatasaray",
  "turk telekom stadyumu": "Galatasaray",
  "sukru saracoglu": "Fenerbahce",
  "la bombonera": "Boca Juniors",
  "monumental": "River Plate",
  "el monumental": "River Plate",
  "mineirao": "Cruzeiro",
  "itaquerao": "Corinthians",
  "arena corinthians": "Corinthians",
  "mangueirao": "Remo",
  "morumbi": "Sao Paulo",
  "morumbis": "Sao Paulo",
  // Estádio Nacional Mané Garrincha (Brasília) — sem "dono" fixo. O
  // usuário confirmou uma lista real de jogos lá entre 2022-2024; usamos
  // os times que mais aparecem nela, do mais frequente pro menos.
  "mane garrincha": ["Flamengo", "Sao Paulo", "Botafogo", "Palmeiras", "Brazil"],
  "estadio nacional mane garrincha": ["Flamengo", "Sao Paulo", "Botafogo", "Palmeiras", "Brazil"],
  "arena brb mane garrincha": ["Flamengo", "Sao Paulo", "Botafogo", "Palmeiras", "Brazil"],
  "estadio governador helio prates da silveira": ["Flamengo", "Sao Paulo", "Botafogo", "Palmeiras", "Brazil"],
};

function stripDiacritics(str) {
  return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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
    homeTeamId: f.teams.home.id,
    awayTeamId: f.teams.away.id,
    homeLogo: f.teams.home.logo,
    awayLogo: f.teams.away.logo,
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    date: f.fixture.date,
    competition: f.league.name,
    country: f.league.country,
    leagueId: f.league.id,
  }));
}

async function ensureLogoCached(teamId, originalUrl) {
  if (!teamId || !originalUrl) return originalUrl;
  const ourUrl = `${TEAM_LOGO_BUCKET_URL}/${teamId}.png`;
  try {
    const head = await fetch(ourUrl, { method: "HEAD" });
    if (head.ok) return ourUrl;
  } catch {}
  try {
    const res = await fetch(originalUrl);
    if (!res.ok) return originalUrl;
    const buffer = await res.arrayBuffer();
    const supabase = supabaseAdmin();
    const { error } = await supabase.storage.from("team-logos").upload(`${teamId}.png`, buffer, { contentType: "image/png", upsert: true });
    if (error) {
      console.error("Erro ao guardar escudo no cache:", error.message);
      return originalUrl;
    }
    return ourUrl;
  } catch (e) {
    console.error("Erro ao baixar escudo pra cachear:", e.message);
    return originalUrl;
  }
}

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

async function teamIdFromName(teamName) {
  const teams = await searchTeams(teamName);
  const best = teams?.find((t) => t.team.name.toLowerCase() === teamName.toLowerCase()) || teams?.[0];
  return best?.team?.id || null;
}

async function teamIdsForVenue(venueId) {
  try {
    const teams = await footballFetchRaw("/teams", { venue: venueId });
    return teams.map((t) => t.team.id).slice(0, 2);
  } catch {
    return [];
  }
}

/**
 * GET /api/attended-games/search-stadium?stadium=Morumbi&season=2024
 *
 * IMPORTANTE (confirmado testando ao vivo): a API-Football às vezes tem
 * dados INCONSISTENTES entre o cadastro do time (aponta pro estádio
 * antigo) e o cadastro do estádio (associa o time errado) — foi
 * exatamente o caso do Morumbi/MorumBIS depois da reforma. Por isso, em
 * vez de cruzar IDs de time e estádio vindos de buscas separadas (que
 * podem não bater), buscamos TODOS os jogos do time na temporada e
 * filtramos comparando o NOME do estádio que cada partida individual
 * já traz — esse dado é sempre correto, vem de dentro do próprio jogo.
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

  const queryNorm = stripDiacritics(rawStadium.toLowerCase()).replace(/[^a-z0-9 ]/g, "").trim();

  try {
    const teamIdCandidates = [];
    let directVenueCandidates = [];

    const nicknameTeams = STADIUM_NICKNAME_TO_TEAM[queryNorm];
    if (nicknameTeams) {
      const names = Array.isArray(nicknameTeams) ? nicknameTeams : [nicknameTeams];
      for (const name of names) {
        const id = await teamIdFromName(name);
        if (id) teamIdCandidates.push(id);
      }
    }

    if (teamIdCandidates.length === 0) {
      try {
        directVenueCandidates = await searchVenues(stripDiacritics(rawStadium));
        for (const v of directVenueCandidates.slice(0, 3)) {
          const ids = await teamIdsForVenue(v.id);
          teamIdCandidates.push(...ids);
        }
      } catch (e) {
        console.error("Busca direta de estádio falhou:", e.message);
      }
    }

    if (teamIdCandidates.length === 0) {
      const id = await teamIdFromName(stripDiacritics(rawStadium));
      if (id) teamIdCandidates.push(id);
    }

    let matchedGames = null;
    let matchedVenueInfo = null;
    let usedNeutralFallback = false;

    if (teamIdCandidates.length === 0) {
      // Nenhum time-âncora confiável (estádio provavelmente neutro/multiuso,
      // sem "dono" fixo — tipo um estádio nacional). Último recurso: busca
      // direto por estádio + cada liga principal do país, sem precisar de
      // time nenhum.
      const venue = directVenueCandidates[0];
      const leagueIds = venue?.country ? MAIN_LEAGUES_BY_COUNTRY[venue.country] || [] : [];
      if (venue && leagueIds.length > 0) {
        const seenIds = new Set();
        const collected = [];
        for (const leagueId of leagueIds) {
          try {
            const fixtures = await footballFetchRaw("/fixtures", { venue: venue.id, league: leagueId, season });
            for (const f of fixtures) {
              if (!seenIds.has(f.fixture.id)) {
                seenIds.add(f.fixture.id);
                collected.push(f);
              }
            }
          } catch (e) {
            console.error(`Fallback estádio neutro (liga ${leagueId}) falhou:`, e.message);
          }
        }
        if (collected.length > 0) {
          usedNeutralFallback = true;
          matchedGames = mapGames(collected);
          const lastFixture = collected[collected.length - 1];
          matchedVenueInfo = {
            id: lastFixture.fixture.venue.id,
            name: lastFixture.fixture.venue.name,
            city: lastFixture.fixture.venue.city || venue.city || null,
            country: lastFixture.league.country,
            capacity: null,
          };
        }
      }

      if (!matchedGames) {
        return Response.json({ found: false, reason: "estadio_nao_encontrado" });
      }
    }

    for (const teamId of matchedGames ? [] : [...new Set(teamIdCandidates)]) {
      const fixtures = await footballFetchRaw("/fixtures", { team: teamId, season });

      const matches = fixtures.filter((f) => {
        const venueName = stripDiacritics((f.fixture.venue?.name || "").toLowerCase()).replace(/[^a-z0-9 ]/g, "");
        if (!venueName) return false;
        return venueName.includes(queryNorm) || queryNorm.includes(venueName);
      });

      if (matches.length > 0) {
        matchedGames = mapGames(matches);
        const lastFixture = matches[matches.length - 1];
        matchedVenueInfo = {
          id: lastFixture.fixture.venue.id,
          name: lastFixture.fixture.venue.name,
          city: lastFixture.fixture.venue.city || null,
          country: lastFixture.league.country,
          capacity: null,
        };
        break;
      }
    }

    if (!matchedGames) {
      return Response.json({ found: false, reason: "sem_jogos_no_periodo" });
    }

    // A pessoa pode ter visto um jogo de OUTRO clube no mesmo estádio —
    // estádios não pertencem a um time só (o Morumbi recebe majoritariamente
    // o São Paulo, mas às vezes hospeda jogos de outros clubes também).
    // Agora que sabemos o ID real do estádio (confirmado pelos jogos do
    // primeiro time), buscamos de novo por estádio + competição, sem
    // travar num time só, pra pegar esses outros jogos.
    const leagueIds = usedNeutralFallback ? [] : [...new Set(matchedGames.map((g) => g.leagueId).filter(Boolean))];
    const seenIds = new Set(matchedGames.map((g) => g.apiFixtureId));
    for (const leagueId of leagueIds) {
      try {
        const extra = await footballFetchRaw("/fixtures", { venue: matchedVenueInfo.id, league: leagueId, season });
        for (const f of extra) {
          if (!seenIds.has(f.fixture.id)) {
            seenIds.add(f.fixture.id);
            matchedGames.push(mapGames([f])[0]);
          }
        }
      } catch (e) {
        console.error("Erro ao expandir busca por estádio+competição:", e.message);
      }
    }
    matchedGames.sort((a, b) => new Date(a.date) - new Date(b.date));

    const games = await cacheGameLogos(matchedGames);

    return Response.json({ found: true, venue: matchedVenueInfo, games });
  } catch (e) {
    console.error("Erro em /api/attended-games/search-stadium:", e);
    return Response.json({ error: e.message || "Não foi possível buscar os jogos." }, { status: 500 });
  }
}
