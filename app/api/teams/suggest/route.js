import { tooManyRequests } from "@/lib/rateLimit";
import { searchTeams } from "@/lib/footballApi";
import { toApiCountryName } from "@/lib/countries";
import { splitWomenName, isWomenTeamName } from "@/lib/womenFootball";

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
  const limited = tooManyRequests(request, "team-suggest", 120);
  if (limited) return limited;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const mode = searchParams.get("mode");

  if (!q || q.length < 3) {
    return Response.json({ suggestions: [] });
  }

  try {
    // "Arsenal Feminino" / "Arsenal - Feminino": procura o clube e fica só com o time feminino dele.
    const { base, women: wantsWomen } = mode === "selecao" ? { base: q, women: false } : splitWomenName(q);
    const teams = await searchTeams(mode === "selecao" ? toApiCountryName(q) : base);

    let filtered = teams || [];
    if (mode === "selecao") {
      filtered = filtered.filter((t) => t.team.national === true);
    } else {
      // Time de base/reserva atrapalha; o time FEMININO aparece como opção própria ("Arsenal - Feminino"),
      // separado do masculino, pra os resultados nunca virem misturados.
      filtered = filtered.filter((t) => !/U1\d|U2\d| II$| Reserves?/i.test(t.team.name));
      if (wantsWomen) filtered = filtered.filter((t) => isWomenTeamName(t.team.name));
      // cada time feminino logo depois do masculino do mesmo clube
      const order = [];
      for (const t of filtered) {
        const key = splitWomenName(t.team.name).base.toLowerCase();
        if (!order.includes(key)) order.push(key);
      }
      filtered = [...filtered].sort((x, y) => {
        const kx = order.indexOf(splitWomenName(x.team.name).base.toLowerCase());
        const ky = order.indexOf(splitWomenName(y.team.name).base.toLowerCase());
        return kx - ky || Number(isWomenTeamName(x.team.name)) - Number(isWomenTeamName(y.team.name));
      });
    }

    const suggestions = filtered.slice(0, 8).map((t) => ({ name: t.team.name, country: t.team.country, logo: t.team.logo }));

    return Response.json({ suggestions });
  } catch (e) {
    console.error("Erro em /api/teams/suggest:", e.message);
    return Response.json({ suggestions: [] });
  }
}
