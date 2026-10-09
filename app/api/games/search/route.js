import { searchGames, DateNotAvailableError, QuotaError } from "@/lib/gamesSearch";
import { validateDate } from "@/lib/gamesSearchCore";

export const dynamic = "force-dynamic";

/**
 * GET /api/games/search?date=2026-10-17&lat=-23.55&lon=-46.63&radius=150
 *
 * Jogos de uma data, dentro de um raio (em km, em linha reta) de uma
 * cidade-base, do mais perto pro mais longe. Quem decide se vai gastar
 * uma chamada da API-Football é o cache: só a primeira busca de cada data
 * (ou a primeira depois de ~6h) vai lá.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const lat = parseFloat(searchParams.get("lat"));
  const lon = parseFloat(searchParams.get("lon"));
  const country = (searchParams.get("country") || "").toUpperCase().slice(0, 2) || null;
  const radiusRaw = parseFloat(searchParams.get("radius") || "150");

  const dateError = validateDate(date);
  if (dateError) return Response.json({ error: "INVALID_DATE", message: dateError }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json({ error: "INVALID_LOCATION", message: "Escolha uma cidade-base da lista." }, { status: 400 });
  }
  const radiusKm = Math.min(Math.max(Number.isFinite(radiusRaw) ? radiusRaw : 150, 10), 1000);

  try {
    const result = await searchGames({ date, lat, lon, radiusKm, country });
    return Response.json(result);
  } catch (e) {
    if (e instanceof DateNotAvailableError) {
      return Response.json(
        { error: "DATE_NOT_AVAILABLE", message: "Ainda não temos os jogos dessa data carregados. Tente outra data." },
        { status: 422 }
      );
    }
    if (e instanceof QuotaError) {
      return Response.json(
        { error: "QUOTA", message: "Estamos com muita procura agora. Tente de novo daqui a pouco." },
        { status: 503 }
      );
    }
    console.error("Erro em /api/games/search:", e);
    return Response.json({ error: "SERVER", message: "Não foi possível buscar os jogos agora." }, { status: 500 });
  }
}
