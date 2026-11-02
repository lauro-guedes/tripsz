/**
 * tripsz.social — a aba Estádios: os estádios do calendário de jogos do app, com a distância da pessoa, se ela já visitou,
 * check-ins de hoje e amigos que já foram (SÓ no servidor). Só contagens: nada de quem fez o check-in.
 */
import { distanceMeters } from "./geo";
import { searchKey } from "./searchKey";
import { followGraph, must, fail } from "./socialShared";
import { stadiumSlug } from "./stadiumPages";

const TTL_MS = 10 * 60 * 1000;
const MAX = 30;
const SCOPES = ["todos", "visitados", "nao_visitados"];
let cache = null;
export const _resetStadiumCache = () => { cache = null; };

/** Estádios distintos do calendário (cache de 10 min no servidor). */
async function venues(supabase, now) {
  if (cache && now - cache.at < TTL_MS) return cache.list;
  const { data } = must(await supabase.from("fixtures_calendar").select("venue_name, venue_city, league_country, lat, lon").not("venue_name", "is", null).limit(8000));
  const by = new Map();
  for (const r of data || []) {
    const key = searchKey(r.venue_name);
    if (!key || by.has(key)) continue;
    by.set(key, { key, name: r.venue_name, city: r.venue_city || null, country: r.league_country || null, lat: Number(r.lat), lon: Number(r.lon), slug: stadiumSlug(r.venue_name, r.venue_city) });
  }
  cache = { at: now, list: [...by.values()] };
  return cache.list;
}

/**
 * scope: todos | visitados | nao_visitados. `q`: busca por nome ou cidade. `lat`/`lon` (opcionais): ordena do mais perto pro mais longe e
 * dá a distância; sem eles, ordena por check-ins de hoje e nome.
 */
export async function listStadiums(supabase, viewer, { scope = "todos", q = "", lat, lon, now = Date.now() } = {}) {
  if (!SCOPES.includes(scope)) return fail("invalid_field");
  const all = await venues(supabase, now);
  const num = (v) => (v === null || v === "" || typeof v === "boolean" ? NaN : Number(v));
  const pos = Number.isFinite(num(lat)) && Number.isFinite(num(lon)) && Math.abs(num(lat)) <= 90 && Math.abs(num(lon)) <= 180 ? { lat: num(lat), lon: num(lon) } : null;
  const needle = searchKey(String(q || "").slice(0, 80));

  const { data: mine } = must(await supabase.from("attended_games").select("stadium").eq("user_id", viewer.id).limit(5000));
  const visited = new Set((mine || []).map((g) => searchKey(g.stadium)).filter(Boolean));

  let list = all.filter((v) => (!needle || searchKey(`${v.name} ${v.city || ""}`).includes(needle)) && (scope === "todos" || (scope === "visitados") === visited.has(v.key)));
  if (pos) list = list.map((v) => ({ ...v, d: Number.isFinite(v.lat) && Number.isFinite(v.lon) ? distanceMeters(pos.lat, pos.lon, v.lat, v.lon) : Infinity })).sort((a, b) => a.d - b.d);
  const nearest = pos && list[0] && list[0].d < 100000 ? list[0].city : null;

  // números só dos estádios que vão aparecer (check-ins de hoje e amigos que já foram)
  const since = new Date(now - 24 * 3600 * 1000).toISOString();
  const [ck, g] = await Promise.all([
    supabase.from("posts").select("author_id, stadium_name").eq("kind", "checkin").eq("visibility", "public").is("deleted_at", null).gte("created_at", since).limit(5000),
    followGraph(supabase, viewer.id),
  ]);
  must(ck);
  const checkins = new Map();
  for (const r of ck.data || []) { const k = searchKey(r.stadium_name); (checkins.get(k) || checkins.set(k, new Set()).get(k)).add(r.author_id); }
  const friendsBy = new Map();
  if (g.following.length) {
    const { data: fg } = must(await supabase.from("attended_games").select("user_id, stadium").in("user_id", g.following).limit(20000));
    for (const r of fg || []) { const k = searchKey(r.stadium); (friendsBy.get(k) || friendsBy.set(k, new Set()).get(k)).add(r.user_id); }
  }
  const out = list.map((v) => ({ name: v.name, city: v.city, country: v.country, slug: v.slug, visited: visited.has(v.key), distance: pos && Number.isFinite(v.d) ? Math.round(v.d) : null, checkinsToday: (checkins.get(v.key) || new Set()).size, friends: (friendsBy.get(v.key) || new Set()).size }));
  if (!pos) out.sort((a, b) => b.checkinsToday - a.checkinsToday || a.name.localeCompare(b.name));
  return { ok: true, stadiums: out.slice(0, MAX), total: out.length, nearCity: nearest };
}
