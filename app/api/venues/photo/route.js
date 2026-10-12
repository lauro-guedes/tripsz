import { searchKey } from "@/lib/searchKey";

export const dynamic = "force-dynamic";

/**
 * GET /api/venues/photo?name=Allianz%20Parque&city=S%C3%A3o%20Paulo
 *
 * Foto REAL do estádio, pra quando a API-Football não tem a imagem dele.
 * Procura na Wikipedia (inglês e português) a página do estádio e devolve a
 * imagem principal dela. A resposta fica em cache (CDN/Next) por 30 dias, então
 * cada estádio só é buscado uma vez. Sem resultado confiável → { url: null }
 * e a tela usa a imagem genérica.
 */
const WIKIS = ["en", "pt"];
const GENERIC = new Set(["estadio", "stadium", "stade", "stadion", "estadio", "arena", "de", "do", "da", "dos", "das", "the", "of", "del", "la", "el"]);

function significantTokens(str) {
  return searchKey(str)
    .split(" ")
    .filter((t) => t.length >= 4 && !GENERIC.has(t));
}

async function lookup(lang, query, nameTokens) {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "5");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "1000");
  const res = await fetch(url.toString(), { headers: { "User-Agent": "tripsz/1.0 (https://tripsz.vercel.app)" }, next: { revalidate: 60 * 60 * 24 * 30 } });
  if (!res.ok) return null;
  const json = await res.json();
  const pages = Object.values(json.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const p of pages) {
    if (!p.thumbnail?.source) continue;
    const titleKey = searchKey(p.title);
    // O título da página precisa conter a palavra principal do nome do estádio —
    // melhor não mostrar foto nenhuma do que a de outro lugar.
    if (nameTokens.length > 0 && nameTokens.some((t) => titleKey.includes(t))) {
      return { url: p.thumbnail.source, title: p.title, lang };
    }
  }
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "").trim().slice(0, 120);
  const city = (searchParams.get("city") || "").trim().slice(0, 80);
  if (name.length < 3) return Response.json({ url: null });
  const nameTokens = significantTokens(name);
  try {
    for (const lang of WIKIS) {
      const hit = (await lookup(lang, `${name} ${city} stadium`, nameTokens)) || (await lookup(lang, name, nameTokens));
      if (hit) {
        return Response.json({ url: hit.url, source: `Wikipedia (${hit.lang})`, page: `https://${hit.lang}.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, "_"))}` }, { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" } });
      }
    }
    return Response.json({ url: null }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch (e) {
    console.error("Erro em /api/venues/photo:", e.message);
    return Response.json({ url: null });
  }
}
