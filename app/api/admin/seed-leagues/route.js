import { searchLeaguesByCountry } from "@/lib/footballApi";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/admin/seed-leagues?token=SEU_CRON_SECRET
 *
 * Rota de uso único: resolve e cadastra automaticamente a liga principal
 * de cada um dos 13 países do app na tabela `leagues` do Supabase.
 * Pra cada país, busca as ligas desse país na API-Football e escolhe a
 * que bate com o nome esperado (ex: "Premier League" pra Inglaterra) —
 * assim não precisamos copiar ID por ID manualmente.
 *
 * Gasta 1 requisição da cota diária por país (13 no total).
 */

// Nome (ou parte do nome) da liga principal de cada país, como a
// API-Football costuma nomear. `country` é o valor em inglês que a API
// espera na busca; `appCountry` é como o país aparece no app (StepDestino).
const TARGET_LEAGUES = [
  { country: "England", appCountry: "Inglaterra", nameMatch: "Premier League" },
  { country: "Spain", appCountry: "Espanha", nameMatch: "La Liga" },
  { country: "Italy", appCountry: "Itália", nameMatch: "Serie A" },
  { country: "Germany", appCountry: "Alemanha", nameMatch: "Bundesliga" },
  { country: "France", appCountry: "França", nameMatch: "Ligue 1" },
  { country: "Portugal", appCountry: "Portugal", nameMatch: "Primeira Liga" },
  { country: "Netherlands", appCountry: "Holanda", nameMatch: "Eredivisie" },
  { country: "Turkey", appCountry: "Turquia", nameMatch: "Süper Lig" },
  { country: "Argentina", appCountry: "Argentina", nameMatch: "Liga Profesional" },
  { country: "Brazil", appCountry: "Brasil", nameMatch: "Serie A" },
  { country: "Uruguay", appCountry: "Uruguai", nameMatch: "Primera Division" },
  { country: "Chile", appCountry: "Chile", nameMatch: "Primera Division" },
  { country: "Colombia", appCountry: "Colômbia", nameMatch: "Primera A" },
];

function pickBestMatch(leagues, nameMatch) {
  // Remove acentos de verdade (á→a, ó→o, ç→c...) em vez de simplesmente
  // apagar a letra acentuada — "División" precisa virar "division", não
  // "divisin", senão a comparação com "Division" nunca bate.
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const target = normalize(nameMatch);
  // só ligas de tipo "League" (não copas) e evita ligas de base/mulheres
  const candidates = leagues.filter((l) => l.league.type === "League");
  const exact = candidates.find((l) => normalize(l.league.name) === target);
  if (exact) return exact;
  return candidates.find((l) => normalize(l.league.name).includes(target)) || null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (token !== process.env.CRON_SECRET) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const results = [];

  for (const target of TARGET_LEAGUES) {
    try {
      const leagues = await searchLeaguesByCountry(target.country);
      const match = pickBestMatch(leagues, target.nameMatch);

      if (!match) {
        results.push({ ...target, status: "não encontrada", availableNames: leagues.map((l) => l.league.name) });
        continue;
      }

      const season = match.seasons?.find((s) => s.current)?.year;
      if (!season) {
        results.push({ ...target, status: "sem temporada atual", leagueId: match.league.id });
        continue;
      }

      const { error } = await supabase.from("leagues").upsert(
        {
          country: target.appCountry,
          api_league_id: match.league.id,
          api_season: season,
          name: match.league.name,
          tier: 1,
          active: true,
        },
        { onConflict: "api_league_id" }
      );

      if (error) throw error;

      results.push({ ...target, status: "cadastrada", leagueId: match.league.id, name: match.league.name, season });
    } catch (e) {
      results.push({ ...target, status: "erro", error: e.message });
    }
  }

  return Response.json({ results });
}
