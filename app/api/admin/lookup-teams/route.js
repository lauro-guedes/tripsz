import { searchTeams } from "@/lib/footballApi";

/**
 * GET /api/admin/lookup-teams?token=SEU_CRON_SECRET
 *
 * Rota de uso único: busca na API-Football o time correto pra cada nome
 * usado no TEAM_LOGO_IDS do app, e devolve o id + logo real de cada um —
 * pra confirmar/corrigir o mapeamento sem precisar adivinhar IDs.
 *
 * Gasta 1 requisição da cota diária por time (30 no total).
 */

// Mesma lista de nomes usada em TEAM_LOGO_IDS no TripszApp.jsx.
const TEAM_NAMES = [
  "Arsenal", "Chelsea", "Liverpool", "Manchester City", "Tottenham",
  "Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla",
  "Bayern Munich", "Borussia Dortmund", "Paris Saint Germain", "Marseille",
  "Porto", "Benfica", "Ajax", "Feyenoord", "PSV",
  "Galatasaray", "Fenerbahce", "Boca Juniors", "River Plate",
  "Flamengo", "Fluminense", "Corinthians", "Palmeiras",
  "Inter", "Milan", "Napoli", "Roma", "Lazio",
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (token !== process.env.CRON_SECRET) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const results = {};
  for (const name of TEAM_NAMES) {
    try {
      const teams = await searchTeams(name);
      results[name] = teams.slice(0, 3).map((t) => ({
        id: t.team.id,
        name: t.team.name,
        country: t.team.country,
        logo: t.team.logo,
      }));
    } catch (e) {
      results[name] = { error: e.message };
    }
  }

  return Response.json({ results });
}
