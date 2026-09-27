import { searchTeams } from "@/lib/footballApi";

/**
 * GET /api/teams/suggest?q=fio
 *
 * Autocomplete pra tela "Quais são seus times favoritos?" — busca times
 * de verdade na API-Football (não só a lista fixa de ~30 times que já
 * vem pré-selecionada por liga), então qualquer clube real aparece aqui,
 * mesmo um menor como a Fiorentina.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 3) {
    return Response.json({ suggestions: [] });
  }

  try {
    const teams = await searchTeams(q);
    // Filtra times de base/reserva/feminino, que só atrapalham a busca
    // de um torcedor comum procurando o time principal.
    const suggestions = (teams || [])
      .filter((t) => !/U1\d|U2\d| W$| II$| Women| Reserves?/i.test(t.team.name))
      .slice(0, 8)
      .map((t) => ({ name: t.team.name, country: t.team.country, logo: t.team.logo }));

    return Response.json({ suggestions });
  } catch (e) {
    console.error("Erro em /api/teams/suggest:", e.message);
    return Response.json({ suggestions: [] });
  }
}
