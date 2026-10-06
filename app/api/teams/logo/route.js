import { resolveTeamLogoByName } from "@/lib/teamLogos";

export const dynamic = "force-dynamic";

/**
 * GET /api/teams/logo?name=Racing Club
 * Devolve { logo } com o link do escudo (cópia nossa), ou { logo: null }
 * quando não achou com certeza. Usada pelos jogos que ficaram sem escudo.
 * O resultado fica guardado no CDN por um dia (e no cache do Next por uma
 * semana), então o mesmo nome não gasta outra chamada da API.
 */
export async function GET(request) {
  const name = (new URL(request.url).searchParams.get("name") || "").trim();
  const result = await resolveTeamLogoByName(name);
  return Response.json(
    { logo: result.logo },
    { headers: { "Cache-Control": result.apiError ? "no-store" : "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
