import { searchVenues } from "@/lib/footballApi";
import { supabaseAdmin } from "@/lib/supabase";

// A API-Football devolve o país do estádio em inglês; nossa tabela
// `leagues` guarda o país em português (do jeito que o app já usa em
// StepDestino). Esse mapa só existe pra ligar as duas pontas.
const COUNTRY_EN_TO_PT = {
  England: "Inglaterra",
  Spain: "Espanha",
  Italy: "Itália",
  Germany: "Alemanha",
  France: "França",
  Portugal: "Portugal",
  Netherlands: "Holanda",
  Turkey: "Turquia",
  Argentina: "Argentina",
  Brazil: "Brasil",
  Uruguay: "Uruguai",
  Chile: "Chile",
  Colombia: "Colômbia",
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

/**
 * GET /api/attended-games/search-stadium?stadium=Emirates&season=2024
 *
 * Fluxo de "Registrar Jogo": busca por ESTÁDIO em vez de time.
 *
 * IMPORTANTE: a API-Football não aceita filtrar `/fixtures` só por
 * `venue` + `season` — ela exige que isso venha junto de `league`
 * também (confirmado testando ao vivo). Por isso:
 * 1. Acha o estádio pelo nome (searchVenues).
 * 2. Descobre o país do estádio e busca a liga principal desse país
 *    na nossa própria tabela `leagues` do Supabase (já cadastrada antes).
 * 3. Só então pede pra API-Football os jogos daquele estádio, filtrados
 *    pela liga certa.
 *
 * Se o país do estádio não for um dos que já temos cadastrado, ou se o
 * estádio não for encontrado, devolve { found: false } e o app cai no
 * formulário manual.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const stadium = searchParams.get("stadium")?.trim();
  const season = parseInt(searchParams.get("season"), 10);

  if (!stadium) {
    return Response.json({ error: "Informe o nome do estádio." }, { status: 400 });
  }
  if (!season || season < 2022 || season > 2024) {
    return Response.json({ error: "Escolha um ano entre 2022 e 2024." }, { status: 400 });
  }

  try {
    const venues = await searchVenues(stadium);
    if (!venues || venues.length === 0) {
      return Response.json({ found: false, reason: "estadio_nao_encontrado" });
    }
    const venue = venues[0];

    const countryPt = COUNTRY_EN_TO_PT[venue.country];
    if (!countryPt) {
      return Response.json({ found: false, reason: "pais_nao_suportado", venue });
    }

    const supabase = supabaseAdmin();
    const { data: league } = await supabase
      .from("leagues")
      .select("api_league_id, name")
      .eq("country", countryPt)
      .eq("active", true)
      .maybeSingle();

    if (!league) {
      return Response.json({ found: false, reason: "liga_nao_cadastrada", venue });
    }

    const fixtures = await footballFetchRaw("/fixtures", {
      league: league.api_league_id,
      season,
      venue: venue.id,
    });

    const games = fixtures.map((f) => ({
      apiFixtureId: f.fixture.id,
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeScore: f.goals.home,
      awayScore: f.goals.away,
      date: f.fixture.date,
      competition: f.league.name,
      country: f.league.country,
    }));

    return Response.json({
      found: true,
      venue: { id: venue.id, name: venue.name, city: venue.city, country: venue.country, capacity: venue.capacity },
      league: league.name,
      games,
    });
  } catch (e) {
    console.error("Erro em /api/attended-games/search-stadium:", e);
    return Response.json({ error: e.message || "Não foi possível buscar os jogos." }, { status: 500 });
  }
}
