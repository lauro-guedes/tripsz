import { searchLeaguesByCountry } from "@/lib/footballApi";

/**
 * GET /api/admin/discover-leagues?country=England&token=SEU_CRON_SECRET
 *
 * Rota de uso único (nossa, não do público): devolve as ligas que a
 * API-Football conhece pra um país, com o "id" real de cada uma.
 * Usamos isso pra descobrir os IDs certos antes de configurar a
 * sincronização de verdade — depois disso, essa rota não precisa
 * ser chamada de novo.
 *
 * Protegida por um token simples pra ninguém de fora ficar gastando
 * nossa cota de 100 requisições/dia sem querer.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const country = searchParams.get("country");

  if (token !== process.env.CRON_SECRET) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!country) {
    return Response.json({ error: "Informe ?country=NomeDoPaís (em inglês, ex: England, Spain, Italy)." }, { status: 400 });
  }

  try {
    const leagues = await searchLeaguesByCountry(country);
    const simplified = leagues.map((l) => ({
      id: l.league.id,
      name: l.league.name,
      type: l.league.type, // "League" ou "Cup"
      country: l.country.name,
      currentSeason: l.seasons?.find((s) => s.current)?.year,
    }));
    return Response.json({ country, results: simplified });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
