import { getCachedTeamLogo } from "@/lib/teamLogos";

export const dynamic = "force-dynamic";

/**
 * GET /api/teams/logo?id=505&name=Inter
 * Devolve { logo } com o link do escudo (cópia nossa), ou { logo: null }
 * quando não achou com certeza. Usa o cache permanente (tabela
 * `team_logos`): cada time é buscado na API uma única vez, e depois
 * essa rota só lê o banco. `id` é opcional (ID do time na API-Football).
 */
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const name = (params.get("name") || "").trim().slice(0, 60);
  const id = params.get("id");
  let logo = null;
  try {
    logo = await getCachedTeamLogo({ teamId: id, name });
  } catch (e) {
    console.error("Erro em /api/teams/logo:", e);
    return Response.json({ logo: null }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ logo }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
