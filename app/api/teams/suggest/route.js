import { searchTeams } from "@/lib/footballApi";
import { toApiCountryName } from "@/lib/countries";

export const dynamic = "force-dynamic";

/**
 * GET /api/teams/suggest?q=fio
 * GET /api/teams/suggest?q=Brasil&mode=selecao
 *
 * Autocomplete pra tela "Quais são seus times favoritos?" e pra aba
 * "Seleções" de Registrar Jogo — busca times de verdade na API-Football
 * (não só a lista fixa de ~30 times que já vem pré-selecionada por
 * liga), então qualquer clube real aparece aqui, mesmo um menor como a
 * Fiorentina. Com mode=selecao, filtra só seleções nacionais e traduz
 * nomes de país em português pro inglês que a API espera.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const mode = searchParams.get("mode");

  if (!q || q.length < 3) {
    return Response.json({ suggestions: [] });
  }

  try {
    const teams = await searchTeams(mode === "selecao" ? toApiCountryName(q) : q);

    let filtered = teams || [];
    if (mode === "selecao") {
      filtered = filtered.filter((t) => t.team.national === true);
    } else {
      // Filtra times de base/reserva/feminino, que só atrapalham a busca
      // de um torcedor comum procurando o time principal.
      filtered = filtered.filter((t) => !/U1\d|U2\d| W$| II$| Women| Reserves?/i.test(t.team.name));
    }

    const suggestions = filtered.slice(0, 8).map((t) => ({ name: t.team.name, country: t.team.country, logo: t.team.logo }));

    return Response.json({ suggestions });
  } catch (e) {
    console.error("Erro em /api/teams/suggest:", e.message);
    return Response.json({ suggestions: [] });
  }
}
