import { wikiVenueInfo } from "@/lib/venueWiki";

export const dynamic = "force-dynamic";

/**
 * GET /api/venues/photo?name=Allianz%20Parque&city=S%C3%A3o%20Paulo   (&debug=1 mostra os candidatos)
 * Foto real e capacidade do estádio pela Wikipedia/Wikidata (ver lib/venueWiki.js).
 * Sem resultado confiável → { url: null }.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "1";
  try {
    const info = await wikiVenueInfo(searchParams.get("name"), searchParams.get("city"), { debug });
    const { failed, ...body } = info;
    const ok = body.url || body.capacity;
    const cache = ok ? "public, s-maxage=2592000, stale-while-revalidate=86400" : failed ? "no-store" : "public, s-maxage=86400";
    return Response.json(body, debug ? undefined : { headers: { "Cache-Control": cache } });
  } catch (e) {
    console.error("Erro em /api/venues/photo:", e.message);
    return Response.json({ url: null });
  }
}
