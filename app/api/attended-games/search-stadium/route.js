import { searchVenues, searchTeams } from "@/lib/footballApi";
import { supabaseAdmin } from "@/lib/supabase";

const TEAM_LOGO_BUCKET_URL = "https://aswxlrabhyzblyliyvjn.supabase.co/storage/v1/object/public/team-logos";

// Testamos ao vivo: a busca de ESTÁDIO da API-Football (/venues) não
// acha vários apelidos populares (Anfield, Old Trafford, San Siro,
// Wanda Metropolitano, Signal Iduna Park...), mesmo eles existindo na
// base. Só que a busca de TIME (/teams) sempre devolve o estádio junto
// — inclusive com esse mesmo apelido. Então, pros casos mais famosos,
// resolvemos o estádio through o time que joga nele, em vez de tentar
// achar o nome exato que a busca de estádio aceita.
const STADIUM_NICKNAME_TO_TEAM = {
  // Inglaterra
  "anfield": "Liverpool",
  "old trafford": "Manchester United",
  "stamford bridge": "Chelsea",
  "etihad stadium": "Manchester City",
  "etihad": "Manchester City",
  // Espanha
  "wanda metropolitano": "Atletico Madrid",
  "metropolitano": "Atletico Madrid",
  "ramon sanchez-pizjuan": "Sevilla",
  "sanchez pizjuan": "Sevilla",
  // Itália
  "san siro": "Inter",
  "giuseppe meazza": "Inter",
  "stadio olimpico": "Roma",
  // Alemanha
  "signal iduna park": "Borussia Dortmund",
  "westfalenstadion": "Borussia Dortmund",
  "allianz arena": "Bayern München",
  // França
  "velodrome": "Marseille",
  "orange velodrome": "Marseille",
  // Portugal
  "estadio da luz": "Benfica",
  "estadio do dragao": "Porto",
  // Holanda
  "johan cruyff arena": "Ajax",
  "amsterdam arena": "Ajax",
  "de kuip": "Feyenoord",
  // Turquia
  "ali sami yen": "Galatasaray",
  "turk telekom stadyumu": "Galatasaray",
  "sukru saracoglu": "Fenerbahce",
  // Argentina
  "la bombonera": "Boca Juniors",
  "monumental": "River Plate",
  "el monumental": "River Plate",
  // Brasil
  "mineirao": "Cruzeiro",
  "itaquerao": "Corinthians",
  "arena corinthians": "Corinthians",
  "mangueirao": "Remo",
};

// A API-Football rejeita caracteres acentuados na busca de estádio
// ("ã", "ç" etc não passam na validação deles) — removemos os acentos
// antes de mandar pra eles, só pra essa chamada específica.
function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
  }));
}

// Cache que cresce sozinho: se já temos o escudo desse time guardado no
// Supabase Storage (dos 30 fixos ou de uma busca anterior), usa nossa
// cópia. Senão, baixa da API-Football agora e guarda pra próxima vez —
// assim qualquer time que apareça numa busca de Registrar Jogo fica
// protegido depois da primeira vez que alguém o encontrar.
async function ensureLogoCached(teamId, originalUrl) {
  if (!teamId || !originalUrl) return originalUrl;
  const ourUrl = `${TEAM_LOGO_BUCKET_URL}/${teamId}.png`;
  try {
    const head = await fetch(ourUrl, { method: "HEAD" });
    if (head.ok) return ourUrl;
  } catch {
    // segue pro download abaixo
  }
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

// Processa cada time só UMA vez por busca (mesmo que apareça em vários
// jogos), pra não repetir download à toa.
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

// Acha o estádio e o time através do nome do time — usado pros apelidos
// conhecidos, e como último recurso caso a busca direta não ache nada.
async function venueFromTeamName(teamName) {
  const teams = await searchTeams(teamName);
  const best = teams?.find((t) => t.team.name.toLowerCase() === teamName.toLowerCase()) || teams?.[0];
  if (!best?.venue) return null;
  // Confirmado testando ao vivo: o estádio devolvido junto da busca de
  // TIME não tem o campo "country" (só id/name/address/city/capacity) —
  // sem isso, salvar o jogo depois falhava (a tabela exige país
  // preenchido). Usamos o país do próprio time como respaldo.
  const venue = { ...best.venue, country: best.venue.country || best.team.country };
  return { venue, teamId: best.team.id };
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

    const nicknameTeam = STADIUM_NICKNAME_TO_TEAM[stripDiacritics(rawStadium.toLowerCase())];
    if (nicknameTeam) {
      const r = await venueFromTeamName(nicknameTeam);
      if (r) candidates.push(r);
    }

    // Só faz a busca direta de estádio se o apelido não resolveu — evita
    // gastar uma chamada à toa, e evita que um erro aqui (ex: acento
    // rejeitado pela API) derrube um resultado que já tínhamos achado.
    if (candidates.length === 0) {
      try {
        const directVenues = await searchVenues(stripDiacritics(rawStadium));
        directVenues.slice(0, 3).forEach((v) => candidates.push({ venue: v, teamId: null }));
      } catch (e) {
        console.error("Busca direta de estádio falhou:", e.message);
      }
    }

    if (candidates.length === 0) {
      // Último recurso: talvez a pessoa tenha digitado o nome de um time.
      try {
        const r = await venueFromTeamName(stripDiacritics(rawStadium));
        if (r) candidates.push(r);
      } catch (e) {
        console.error("Busca por nome de time (último recurso) falhou:", e.message);
      }
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

    games = await cacheGameLogos(games);

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
