import { searchKey } from "@/lib/searchKey";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/venues/photo?name=Allianz%20Parque&city=S%C3%A3o%20Paulo
 * (&debug=1 mostra os candidatos considerados e a pontuação de cada um)
 *
 * Foto REAL do estádio, pra quando a API-Football não tem a imagem dele.
 * Procura na Wikipedia (inglês e português) e só aceita uma página que:
 *   - seja de estádio/arena (pela descrição curta da Wikipedia);
 *   - tenha no título (ou na descrição) a maior parte das palavras do nome;
 *   - tenha como imagem principal uma FOTO (não escudo, bandeira, mapa, SVG).
 * Sem resultado confiável → { url: null } e a tela usa a imagem genérica.
 * A resposta fica em cache por 30 dias, então cada estádio é buscado uma vez.
 */
const WIKIS = ["en", "pt"];
const GENERIC = new Set(["estadio", "stadium", "stade", "stadion", "stadio", "estadi", "arena", "municipal", "de", "do", "da", "dos", "das", "the", "of", "del", "la", "el", "football", "futebol", "club", "park", "parque", "ground", "campo", "complexo", "complex"]);
const STADIUM_WORDS = /stadium|estádio|estadio|arena|stadion|stade|stadio|football ground|soccer|football venue|sports venue|multi-purpose|multipurpose|ground in|campo|park in|football pitch/i;
const BAD_IMAGE = /logo|crest|badge|escudo|emblem|flag|bandeira|map|mapa|seal|coat[_ -]of|shield|brasao|wordmark|icon|\.svg|location|locator|plan|diagram|seating/i;

const tokens = (str) => searchKey(str).split(" ").filter((t) => t.length >= 3);
const distinctive = (str) => tokens(str).filter((t) => !GENERIC.has(t));

async function lookup(lang, query) {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  const set = (k, v) => url.searchParams.set(k, v);
  set("action", "query");
  set("format", "json");
  set("generator", "search");
  set("gsrsearch", query);
  set("gsrlimit", "6");
  set("prop", "pageimages|description|extracts");
  set("piprop", "thumbnail|name");
  set("pithumbsize", "800");
  set("exintro", "1");
  set("explaintext", "1");
  set("exchars", "700");
  set("exlimit", "6");
  try {
    const res = await fetch(url.toString(), { headers: { "User-Agent": "tripsz/1.0 (https://tripsz.vercel.app)" }, next: { revalidate: 60 * 60 * 24 * 30 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return Object.assign([], { failed: true });
    const json = await res.json();
    return Object.values(json.query?.pages || {}).map((p) => ({ ...p, lang }));
  } catch {
    return Object.assign([], { failed: true }); // lento demais ou fora do ar: segue com o que tiver
  }
}

/** "Estádio Jornalista Mário Filho (Maracanã)" -> o nome inteiro, o de fora dos parênteses e o de dentro. */
function nameVariants(name) {
  const inside = [...name.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim());
  const outside = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  return [...new Set([name, outside, ...inside].filter((v) => v.length >= 3))];
}

function score(page, variants, cityTokens) {
  if (!page.thumbnail?.source) return { ok: false, why: "sem imagem" };
  const file = page.pageimage || "";
  if (BAD_IMAGE.test(file) || BAD_IMAGE.test(page.thumbnail.source)) return { ok: false, why: `imagem não é foto (${file})` };
  const about = `${page.description || ""} ${page.extract || ""}`;
  if (!STADIUM_WORDS.test(page.description || "") && !STADIUM_WORDS.test(page.extract || "")) return { ok: false, why: "página não é de estádio" };
  const titleKey = searchKey(page.title);
  const aboutKey = searchKey(about);
  // Vale a variação do nome que mais bate com o título da página — ou, se o título usa outro
  // nome (ex.: "Mineirão" para "Estádio Governador Magalhães Pinto"), com o texto de abertura da
  // página, onde a Wikipedia lista os nomes oficiais. Pelo texto, a cidade precisa bater também.
  const cityHit = cityTokens.some((t) => titleKey.includes(t) || aboutKey.includes(t));
  let coverage = 0;
  let nameTokens = [];
  let hits = 0;
  let viaAbout = false;
  for (const v of variants) {
    const toks = distinctive(v);
    if (toks.length === 0) continue;
    const hTitle = toks.filter((t) => titleKey.includes(t)).length;
    const hAbout = cityHit || cityTokens.length === 0 ? toks.filter((t) => aboutKey.includes(t)).length : 0;
    const h = Math.max(hTitle, hAbout);
    const cov = Math.max(hTitle / toks.length, (hAbout / toks.length) * 0.9);
    if (cov > coverage || nameTokens.length === 0) {
      coverage = cov;
      nameTokens = toks;
      hits = h;
      viaAbout = (hAbout / toks.length) * 0.9 > hTitle / toks.length;
    }
  }
  // Casar só pelo texto exige que a descrição curta da página diga que é um estádio (não um clube que o cita).
  if (viaAbout && !STADIUM_WORDS.test(page.description || "")) return { ok: false, why: "nome só no texto e a página não é de estádio" };
  // Nome com 1 palavra distintiva só vale se a cidade também bater (evita "Estádio Municipal" de outro lugar).
  const needsCity = nameTokens.length < 2;
  if (coverage < 0.6) return { ok: false, why: `título não bate (${hits}/${nameTokens.length})` };
  if (needsCity && cityTokens.length > 0 && !cityHit) return { ok: false, why: "cidade não bate" };
  return { ok: true, value: coverage * 10 + (cityHit ? 3 : 0) - (page.index || 0) * 0.1 };
}

const FOUND_TTL_MS = 90 * 24 * 3600 * 1000; // foto achada: vale 90 dias
const MISS_TTL_MS = 7 * 24 * 3600 * 1000; // "não achei": tenta de novo em 7 dias

// Cache permanente no banco (tabela venue_photos). Se a tabela não existir, segue sem cache.
async function readCache(key) {
  try {
    const { data } = await supabaseAdmin().from("venue_photos").select("url, source, page, fetched_at").eq("cache_key", key).maybeSingle();
    if (!data) return null;
    const age = Date.now() - new Date(data.fetched_at).getTime();
    if (age > (data.url ? FOUND_TTL_MS : MISS_TTL_MS)) return null;
    // "Não achei" de antes da regra de nomes oficiais (14/10/2026) é ignorado: o estádio é procurado de novo.
    if (!data.url && new Date(data.fetched_at) < new Date("2026-10-14T01:10:00Z")) return null;
    return data.url ? { url: data.url, source: data.source, page: data.page } : { url: null };
  } catch {
    return null;
  }
}
async function writeCache(key, body) {
  try {
    await supabaseAdmin().from("venue_photos").upsert({ cache_key: key, url: body.url || null, source: body.source || null, page: body.page || null, fetched_at: new Date().toISOString() });
  } catch {
    /* sem tabela: ignora */
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "").trim().slice(0, 120);
  const city = (searchParams.get("city") || "").trim().slice(0, 80);
  const debug = searchParams.get("debug") === "1";
  if (name.length < 3) return Response.json({ url: null });

  const variants = nameVariants(name);
  const nameTokens = [...new Set(variants.flatMap(distinctive))];
  const cityTokens = distinctive(city);
  if (nameTokens.length === 0) return Response.json({ url: null, reason: "nome genérico" });

  const cacheKey = `${searchKey(name)}|${searchKey(city)}`;
  if (!debug) {
    const cached = await readCache(cacheKey);
    if (cached) return Response.json(cached, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  }

  try {
    // Todas as buscas (idiomas × variações do nome) saem ao mesmo tempo, em vez de uma depois da outra.
    const queries = [...new Set(variants.flatMap((v) => [v, `${v} ${city}`.trim()]))].slice(0, 4);
    const jobs = WIKIS.flatMap((lang) => queries.map((q) => lookup(lang, q)));
    const results = await Promise.all(jobs);
    const candidates = [];
    for (const pages of results) {
      for (const p of pages) {
        const s = score(p, variants, cityTokens);
        candidates.push({ lang: p.lang, title: p.title, image: p.pageimage, desc: p.description, ...s, thumb: p.thumbnail?.source });
      }
    }
    // Inglês tem preferência: o português só entra se o inglês não achou nada confiável.
    const okEn = candidates.filter((c) => c.ok && c.lang === "en");
    if (okEn.length) candidates.forEach((c) => { if (c.lang !== "en") c.ok = false; });
    const best = candidates.filter((c) => c.ok).sort((a, b) => b.value - a.value)[0];
    const headers = { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" };
    const body = best
      ? { url: best.thumb, source: `Wikipedia (${best.lang})`, page: `https://${best.lang}.wikipedia.org/wiki/${encodeURIComponent(best.title.replace(/ /g, "_"))}` }
      : { url: null };
    // Só grava no cache quando nenhuma consulta falhou (lentidão não vira "sem foto" permanente).
    if (!debug && (best || !results.some((r) => r.failed))) await writeCache(cacheKey, body);
    if (debug) return Response.json({ ...body, nameTokens, cityTokens, candidates: candidates.map(({ thumb, ...c }) => c) });
    return Response.json(body, { headers: best ? headers : { "Cache-Control": results.some((r) => r.failed) ? "no-store" : "public, s-maxage=86400" } });
  } catch (e) {
    console.error("Erro em /api/venues/photo:", e.message);
    return Response.json({ url: null });
  }
}
