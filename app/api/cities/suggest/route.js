import { suggestCities } from "@/lib/cities";

export const dynamic = "force-dynamic";

/**
 * GET /api/cities/suggest?q=sao pa
 * Autocomplete de cidade-base pra busca de jogos. Roda 100% em cima da
 * base de cidades do próprio projeto — não chama nenhuma API externa e
 * não gasta nada de cota.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return Response.json({ suggestions: [] });
  return Response.json({ suggestions: suggestCities(q, 6) });
}
