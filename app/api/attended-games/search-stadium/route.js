import { searchVenues, getFixturesByVenueSeason } from "@/lib/footballApi";

/**
 * GET /api/attended-games/search-stadium?stadium=Emirates&season=2024
 *
 * Novo fluxo de "Registrar Jogo": busca por ESTÁDIO em vez de time.
 * 1. Acha o estádio pelo nome (searchVenues).
 * 2. Busca os jogos que aconteceram lá naquela temporada.
 *
 * Devolve { found: false } se não achar o estádio — o app mostra o
 * formulário manual nesse caso.
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
      return Response.json({ found: false });
    }
    const venue = venues[0];

    const fixtures = await getFixturesByVenueSeason(venue.id, season);
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
      games,
    });
  } catch (e) {
    console.error("Erro em /api/attended-games/search-stadium:", e);
    return Response.json({ error: e.message || "Não foi possível buscar os jogos." }, { status: 500 });
  }
}
