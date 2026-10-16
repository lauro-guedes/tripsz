import { searchKey } from "@/lib/searchKey";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Foto REAL e capacidade de um estádio, pela Wikipedia (inglês e português) e Wikidata.
 * Só aceita uma página de estádio/arena cujo nome (no título ou no texto de abertura) bata com o
 * procurado e cuja imagem principal seja uma FOTO (não escudo, bandeira, mapa, SVG).
 * O resultado fica no banco (tabela venue_photos), então cada estádio é buscado uma vez.
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
  set("prop", "pageimages|description|extracts|pageprops");
  set("ppprop", "wikibase_item");
  set("piprop", "thumbnail|name");
  set("pithumbsize", "800");
  set("exintro", "1");
  set("explaintext", "1");
  set("exchars", "700");
  set("exlimit", "6");
  try {
    const res = await fetch(url.toString(), { headers: { "User-Agent": "tripsz/1.0 (https://www.tripsz.com.br)" }, next: { revalidate: 60 * 60 * 24 * 30 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return Object.assign([], { failed: true });
    const json = await res.json();
    return Object.values(json.query?.pages || {}).map((p) => ({ ...p, lang }));
  } catch {
    return Object.assign([], { failed: true }); // lento demais ou fora do ar: segue com o que tiver
  }
}

// Apelidos e nomes antigos/patrocinados que a Wikipedia usa no lugar do nome que a API devolve.
// "match" é testado contra o nome do estádio (sem acento, minúsculo) e/ou a cidade.
const ALIASES = [
  { name: /\b(peron|racing)\b/, city: /avellaneda|buenos aires|^$/, names: ["Estadio Presidente Perón", "El Cilindro de Avellaneda"] },
  { name: /werktalent|bingoal|kyocera|cars jeans|den haag|ado\b/, city: /haag|hague|^$/, names: ["Bingoal Stadion", "Kyocera Stadion", "Cars Jeans Stadion"] },
  { name: /allianz parque|nubank parque|palestra italia|parque antarctica|palmeiras/, city: /paulo|^$/, names: ["Allianz Parque", "Nubank Parque", "Estádio Palestra Itália"] },
  { name: /san siro|meazza/, city: /mil/, names: ["San Siro", "Stadio Giuseppe Meazza"] },
  { name: /monumental/, city: /buenos aires|nunez|^$/, names: ["Estadio Monumental Antonio Vespucio Liberti", "Estadio Monumental River Plate"] },
  { name: /bombonera|alberto j\. armando|alberto armando/, city: /buenos aires|^$/, names: ["La Bombonera", "Estadio Alberto J. Armando"] },
];
function aliasesFor(name, city) {
  const n = searchKey(name);
  const c = searchKey(city);
  return ALIASES.filter((a) => a.name.test(n) && a.city.test(c)).flatMap((a) => a.names);
}

/** "Estádio Jornalista Mário Filho (Maracanã)" -> o nome inteiro, o de fora dos parênteses e o de dentro. */
function nameVariants(name) {
  const inside = [...name.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim());
  const outside = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  // "San Siro/Giuseppe Meazza" ou "Mineirão - Magalhães Pinto": cada nome sozinho também vale.
  const parts = [name, outside, ...inside].flatMap((v) => v.split(/\s*[\/|]\s*|\s+-\s+/));
  return [...new Set([name, outside, ...inside, ...parts].map((v) => v.trim()).filter((v) => v.length >= 3))];
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
  const cityHit = cityTokens.some((t) => titleKey.includes(t) || aboutKey.includes(t) || (t.length >= 5 && (titleKey.includes(t.slice(0, 4)) || aboutKey.includes(t.slice(0, 4)))));
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
// Linhas anteriores a esta data não guardavam a capacidade: são buscadas de novo.
const CACHE_VALID_FROM = new Date("2026-10-14T11:20:00Z");
async function readCache(key) {
  try {
    const { data } = await supabaseAdmin().from("venue_photos").select("url, source, page, capacity, fetched_at").eq("cache_key", key).maybeSingle();
    if (!data) return null;
    const fetched = new Date(data.fetched_at);
    if (fetched < CACHE_VALID_FROM) return null;
    const age = Date.now() - fetched.getTime();
    if (age > (data.url || data.capacity ? FOUND_TTL_MS : MISS_TTL_MS)) return null;
    return { url: data.url || null, capacity: data.capacity || null, source: data.source || null, page: data.page || null };
  } catch {
    return null;
  }
}
async function writeCache(key, body) {
  try {
    await supabaseAdmin().from("venue_photos").upsert({ cache_key: key, url: body.url || null, source: body.source || null, page: body.page || null, capacity: body.capacity || null, fetched_at: new Date().toISOString() });
  } catch {
    /* sem tabela: ignora */
  }
}

/** Só o que já está guardado no banco (rápido, sem ir à Wikipedia): serve para páginas que não podem esperar a rede. */
export async function cachedVenueInfo(rawName, rawCity) {
  const name = String(rawName || "").trim().slice(0, 120);
  const city = String(rawCity || "").trim().slice(0, 80);
  if (name.length < 3) return null;
  return readCache(`${searchKey(name)}|${searchKey(city)}`);
}

/** Capacidade (propriedade P1083) da página no Wikidata. Pega a declaração preferida, ou a mais recente. */
async function wikidataCapacity(qid) {
  if (!qid) return null;
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=claims&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": "tripsz/1.0 (https://www.tripsz.com.br)" }, next: { revalidate: 60 * 60 * 24 * 30 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = await res.json();
    const claims = json.entities?.[qid]?.claims?.P1083 || [];
    const usable = claims.filter((c) => c.rank !== "deprecated" && c.mainsnak?.datavalue?.value?.amount);
    const pick = usable.find((c) => c.rank === "preferred") || usable[usable.length - 1];
    const n = pick ? Math.round(Math.abs(Number(pick.mainsnak.datavalue.value.amount))) : 0;
    return n >= 500 && n <= 300000 ? n : null;
  } catch {
    return null;
  }
}

/**
 * @returns { url, capacity, source, page } — url/capacity são null quando não achou algo confiável.
 * Com { debug: true } devolve também os candidatos considerados (e não usa nem grava o cache).
 */
export async function wikiVenueInfo(rawName, rawCity, { debug = false } = {}) {
  const name = String(rawName || "").trim().slice(0, 120);
  const city = String(rawCity || "").trim().slice(0, 80);
  if (name.length < 3) return { url: null, capacity: null };

  const variants = [...new Set([...nameVariants(name), ...aliasesFor(name, city)])];
  const nameTokens = [...new Set(variants.flatMap(distinctive))];
  const cityTokens = distinctive(city);
  if (nameTokens.length === 0) return { url: null, capacity: null, reason: "nome genérico" };

  const cacheKey = `${searchKey(name)}|${searchKey(city)}`;
  if (!debug) {
    const cached = await readCache(cacheKey);
    if (cached) return cached;
  }

  // Todas as buscas (idiomas × variações do nome) saem ao mesmo tempo.
  const queries = [...new Set(variants.flatMap((v) => [v, `${v} ${city}`.trim()]))].slice(0, 9);
  const results = await Promise.all(WIKIS.flatMap((lang) => queries.map((q) => lookup(lang, q))));
  const candidates = [];
  for (const pages of results) {
    for (const p of pages) {
      const sc = score(p, variants, cityTokens);
      candidates.push({ lang: p.lang, title: p.title, image: p.pageimage, desc: p.description, qid: p.pageprops?.wikibase_item || null, ...sc, thumb: p.thumbnail?.source });
    }
  }
  // Inglês tem preferência: o português só entra se o inglês não achou nada confiável.
  if (candidates.some((c) => c.ok && c.lang === "en")) candidates.forEach((c) => { if (c.lang !== "en") c.ok = false; });
  const best = candidates.filter((c) => c.ok).sort((a, b) => b.value - a.value)[0];

  const body = best
    ? {
        url: best.thumb,
        capacity: await wikidataCapacity(best.qid),
        source: `Wikipedia (${best.lang})`,
        page: `https://${best.lang}.wikipedia.org/wiki/${encodeURIComponent(best.title.replace(/ /g, "_"))}`,
      }
    : { url: null, capacity: null };

  const failed = results.some((r) => r.failed);
  if (debug) return { ...body, failed, nameTokens, cityTokens, candidates: candidates.map(({ thumb, ...c }) => c) };
  // Só grava quando nenhuma consulta falhou (lentidão não vira "sem foto" permanente).
  if (best || !failed) await writeCache(cacheKey, body);
  return { ...body, failed };
}
