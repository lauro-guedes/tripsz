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

// Times já confirmados na rodada anterior (IDs batem com o que já está
// no app) — não precisa gastar cota buscando eles de novo.
const TEAM_NAMES = [
  "Bayern", "Borussia Dortmund", "Paris Saint Germain", "Marseille",
  "Porto", "Benfica", "Ajax", "Feyenoord",
  "PSV", "Galatasaray", "Fenerbahce", "Boca Juniors",
  "River Plate", "Flamengo", "Fluminense", "Corinthians",
  "Palmeiras", "Inter", "Milan", "Napoli",
  "Roma", "Lazio",
];
const BATCH_SIZE = 6; // ~6 chamadas x 1,2s ≈ 8s, seguro dentro do limite de tempo da função

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (token !== process.env.CRON_SECRET) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const batch = Math.max(1, parseInt(searchParams.get("batch") || "1", 10));
  const totalBatches = Math.ceil(TEAM_NAMES.length / BATCH_SIZE);
  const names = TEAM_NAMES.slice((batch - 1) * BATCH_SIZE, batch * BATCH_SIZE);

  const results = {};
  for (const name of names) {
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
    // O plano grátis da API-Football limita requisições por minuto —
    // essa pausa evita o erro 429 "Too many requests".
    await sleep(1200);
  }

  return Response.json({ batch, totalBatches, results });
}
