/**
 * Coordenadas do ESTÁDIO — SÓ no servidor. O banco só tem a posição da
 * cidade de cada jogo; pro check-in por GPS precisamos do estádio em si.
 * Buscamos no OpenStreetMap (Nominatim) só dos jogos candidatos e guardamos
 * em venue_geo, então cada estádio é consultado uma única vez (se não
 * achar, tenta de novo só depois de 7 dias).
 */
import { distanceMeters } from "@/lib/geo";

const RETRY_MISSING_DAYS = 7;

export function venueKey(name, city) {
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${norm(name)}|${norm(city)}`;
}

async function nominatim(name, city, near) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("q", `${name}, ${city}`);
  const res = await fetch(url.toString(), { headers: { "User-Agent": "tripsz/1.0 (contato@tripsz.com.br)", "Accept-Language": "pt-BR" }, cache: "no-store" });
  if (!res.ok) return undefined; // erro do serviço: não grava, tenta depois
  const hits = await res.json();
  for (const h of hits || []) {
    const lat = Number(h.lat), lon = Number(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // só vale se estiver perto da cidade do jogo (evita estádio homônimo em outro país)
    if (!near || distanceMeters(lat, lon, near.lat, near.lon) <= 60000) return { lat, lon };
  }
  return null;
}

/** { lat, lon } do estádio, null se não achou, undefined se não deu pra consultar agora. */
export async function getVenueCoords(supabase, name, city, near) {
  if (!name) return null;
  const key = venueKey(name, city);
  const { data: cached } = await supabase.from("venue_geo").select("lat, lon, fetched_at").eq("venue_key", key).maybeSingle();
  if (cached) {
    if (cached.lat != null && cached.lon != null) return { lat: cached.lat, lon: cached.lon };
    const ageDays = (Date.now() - new Date(cached.fetched_at).getTime()) / 86400000;
    if (ageDays < RETRY_MISSING_DAYS) return null;
  }
  let found;
  try {
    found = await nominatim(name, city || "", near);
  } catch {
    return undefined;
  }
  if (found === undefined) return undefined;
  await supabase.from("venue_geo").upsert({ venue_key: key, venue_name: name, venue_city: city || null, lat: found?.lat ?? null, lon: found?.lon ?? null, fetched_at: new Date().toISOString() }, { onConflict: "venue_key" });
  return found;
}
