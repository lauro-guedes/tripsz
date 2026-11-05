/**
 * Páginas públicas de estádios (SEO) — SÓ no servidor.
 *
 * Vêm do calendário que o app já guarda (tabela fixtures_calendar): só entram estádios com jogo
 * marcado nas ligas curadas, então não gasta nenhuma chamada da API-Football e não aparece página vazia.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { labelForRow, isPlayable } from "@/lib/calendarCore";
import { searchKey } from "@/lib/searchKey";

const PAGE = 1000;
const TTL_MS = 60 * 60 * 1000;
let cache = null;

export function stadiumSlug(name, city) {
  const base = `${name || ""} ${city || ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function loadRows() {
  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase
      .from("fixtures_calendar")
      .select("fixture_id, kickoff, league_id, league_name, league_country, home_team, away_team, venue_name, venue_city, venue_capacity, venue_cc, status")
      .gte("match_date", today)
      .not("venue_name", "is", null)
      .order("kickoff", { ascending: true })
      .order("fixture_id", { ascending: true })
      .range(start, start + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows.filter((r) => isPlayable(r.status) && r.venue_name && r.venue_name.trim().length >= 3);
}

function mostFrequent(list) {
  const count = new Map();
  for (const v of list.filter(Boolean)) count.set(v, (count.get(v) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/** Todos os estádios com jogo marcado: { slug, name, city, country, capacity, homeTeam, games: [...] } */
export async function allStadiums() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let rows = [];
  try {
    rows = await loadRows();
  } catch (e) {
    console.error("[stadiumPages] falhou ao ler o calendário:", e.message);
    if (cache) return cache.value; // segue com o último resultado bom
    return [];
  }
  // Mesmo estádio com a cidade escrita de formas diferentes ("Concepcion"/"Concepción", "La Coruña"/
  // "A Coruña (La Coruña)") ou sem cidade vira UMA página. Cidades realmente diferentes seguem separadas.
  const cityKey = (c) => searchKey(String(c || "").replace(/\(.*?\)/g, ""));
  const canonCity = new Map(); // nome do estádio -> [{ key, city }]
  for (const r of rows) {
    const nk = searchKey(r.venue_name);
    const list = canonCity.get(nk) || [];
    const k = cityKey(r.venue_city);
    if (k && !list.some((x) => x.key === k || x.key.includes(k) || k.includes(x.key))) list.push({ key: k, city: r.venue_city });
    canonCity.set(nk, list);
  }
  const resolveCity = (r) => {
    const list = canonCity.get(searchKey(r.venue_name)) || [];
    const k = cityKey(r.venue_city);
    if (!k) return list.length === 1 ? list[0].city : r.venue_city; // sem cidade: usa a única conhecida
    const hit = list.find((x) => x.key === k || x.key.includes(k) || k.includes(x.key));
    return hit ? hit.city : r.venue_city;
  };
  const bySlug = new Map();
  for (const r of rows) {
    r.venue_city = resolveCity(r);
    const slug = stadiumSlug(r.venue_name, r.venue_city);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, { slug, name: r.venue_name.trim(), city: r.venue_city || null, rows: [] });
    bySlug.get(slug).rows.push(r);
  }
  const value = [...bySlug.values()].map((s) => {
    const labels = s.rows.map((r) => labelForRow(r) || r.league_country).filter(Boolean);
    return {
      slug: s.slug,
      name: s.name,
      city: s.city,
      country: mostFrequent(labels),
      capacity: Math.max(0, ...s.rows.map((r) => r.venue_capacity || 0)) || null,
      homeTeam: mostFrequent(s.rows.map((r) => r.home_team)),
      games: s.rows.map((r) => ({ id: r.fixture_id, kickoff: r.kickoff, league: r.league_name, home: r.home_team, away: r.away_team })),
    };
  });
  value.sort((a, b) => (a.country || "").localeCompare(b.country || "", "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
  cache = { at: Date.now(), value };
  return value;
}

export async function stadiumBySlug(slug) {
  return (await allStadiums()).find((s) => s.slug === String(slug || "").toLowerCase()) || null;
}

export { searchKey };
