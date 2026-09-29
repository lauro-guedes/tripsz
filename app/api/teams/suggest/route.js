import { searchTeams } from "@/lib/footballApi";

// A API-Football guarda o nome das seleções em inglês — traduzimos os
// nomes mais comuns em português, pra pessoa poder digitar do jeito
// natural (ex: "Brasil" em vez de precisar saber que é "Brazil").
const COUNTRY_NAME_PT_TO_EN = {
  brasil: "Brazil", inglaterra: "England", espanha: "Spain", itália: "Italy",
  italia: "Italy", alemanha: "Germany", frança: "France", franca: "France",
  holanda: "Netherlands", turquia: "Turkey", uruguai: "Uruguay",
  méxico: "Mexico", mexico: "Mexico", japão: "Japan", japao: "Japan",
  "estados unidos": "USA", marrocos: "Morocco", croácia: "Croatia",
  croacia: "Croatia", sérvia: "Serbia", servia: "Serbia", polônia: "Poland",
  polonia: "Poland", bélgica: "Belgium", belgica: "Belgium",
  suíça: "Switzerland", suica: "Switzerland", áustria: "Austria",
  austria: "Austria", dinamarca: "Denmark", suécia: "Sweden",
  suecia: "Sweden", noruega: "Norway", egito: "Egypt",
  "coreia do sul": "South Korea", rússia: "Russia", russia: "Russia",
  grécia: "Greece", grecia: "Greece", escócia: "Scotland",
  escocia: "Scotland", "república tcheca": "Czech Republic",
  "republica tcheca": "Czech Republic", ucrânia: "Ukraine",
  ucrania: "Ukraine", irlanda: "Republic of Ireland", islândia: "Iceland",
  islandia: "Iceland", hungria: "Hungary", índia: "India", india: "India",
  canadá: "Canada", canada: "Canada", peru: "Peru", paraguai: "Paraguay",
  bolívia: "Bolivia", bolivia: "Bolivia", equador: "Ecuador",
  venezuela: "Venezuela", panamá: "Panama", panama: "Panama",
  "costa rica": "Costa Rica", cuba: "Cuba", angola: "Angola",
  moçambique: "Mozambique", mocambique: "Mozambique",
  austrália: "Australia", australia: "Australia",
  "nova zelândia": "New Zealand", "nova zelandia": "New Zealand",
};

function translateCountryName(q) {
  const key = q.trim().toLowerCase();
  return COUNTRY_NAME_PT_TO_EN[key] || q;
}

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
    const teams = await searchTeams(mode === "selecao" ? translateCountryName(q) : q);

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
