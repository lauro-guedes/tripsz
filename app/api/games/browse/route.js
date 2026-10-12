import { browseGames, browseOptions } from "@/lib/gamesBrowse";
import { validateDate } from "@/lib/gamesSearchCore";
import { WIZARD_COUNTRIES } from "@/lib/calendarCore";

export const dynamic = "force-dynamic";

/**
 * GET /api/games/browse?options=1                      -> países e ligas disponíveis
 * GET /api/games/browse?mode=pais&country=Brasil&from=2026-10-17&days=30
 * GET /api/games/browse?mode=liga&league=71&from=...&days=30
 * GET /api/games/browse?mode=clube&team=Flamengo&from=...&days=30
 *
 * Lê só do calendário já guardado no banco — não gasta cota da API-Football.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  try {
    if (searchParams.get("options")) return Response.json(await browseOptions());

    const mode = searchParams.get("mode");
    const from = searchParams.get("from");
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10) || 30, 1), 90);
    const dateError = validateDate(from);
    if (dateError) return Response.json({ error: "INVALID_DATE", message: dateError }, { status: 400 });

    const country = searchParams.get("country") || "";
    const leagueId = parseInt(searchParams.get("league") || "", 10);
    const team = (searchParams.get("team") || "").trim();
    if (mode === "pais" && !WIZARD_COUNTRIES[country]) return Response.json({ error: "INVALID_COUNTRY", message: "Escolha um país da lista." }, { status: 400 });
    if (mode === "liga" && !Number.isFinite(leagueId)) return Response.json({ error: "INVALID_LEAGUE", message: "Escolha uma liga da lista." }, { status: 400 });
    if (mode === "clube" && !team) return Response.json({ error: "INVALID_TEAM", message: "Escolha um clube da lista." }, { status: 400 });
    if (!["pais", "liga", "clube"].includes(mode)) return Response.json({ error: "INVALID_MODE", message: "Modo de busca inválido." }, { status: 400 });

    return Response.json(await browseGames({ mode, country, leagueId, team, from, days }));
  } catch (e) {
    console.error("Erro em /api/games/browse:", e);
    return Response.json({ error: "SERVER", message: "Não foi possível buscar os jogos agora." }, { status: 500 });
  }
}
