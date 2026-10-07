/**
 * Achar o LOCAL dos jogos — SÓ no servidor. Usado pela busca de jogos e pelo
 * calendário do Montar Viagem.
 *
 * Em ordem: o texto que vem no próprio jogo (resolvido em lib/gamesSearchCore)
 * -> o cadastro do estádio, por ID (venues_cache) -> o estádio do time da casa
 * (team_home_venues). O que a API já respondeu fica guardado no nosso banco
 * e nunca é perguntado de novo.
 */
import { findCity, countryCodeFromName } from "@/lib/cities";
import { venueIdsNeedingLookup, teamIdsNeedingLookup } from "@/lib/gamesSearchCore";

const BASE_URL = "https://v3.football.api-sports.io";

// Quantas consultas, no máximo, a gente faz por atualização de data (cada
// uma gasta uma chamada da API; o que já foi consultado nunca é consultado de
// novo). Com o plano Pro (7.500/dia, 300/min) cabe folgado; as consultas
// saem em lotes paralelos pra não deixar a primeira busca da data lenta.
const MAX_VENUE_LOOKUPS_PER_REFRESH = 40;
const MAX_TEAM_LOOKUPS_PER_REFRESH = 60;
const LOOKUP_CONCURRENCY = 6;

export async function apiGet(path, params) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), { headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY }, cache: "no-store" });
  const data = await res.json();
  const errors = data.errors && !Array.isArray(data.errors) ? data.errors : null;
  if (errors && Object.keys(errors).length > 0) return undefined; // a API reclamou (cota/limite): não grava nada
  return data.response || [];
}

/**
 * Consulta um estádio pelo ID no cadastro da API-Football.
 * Devolve { city, country, name }, null (não existe no cadastro) ou
 * undefined (a API reclamou).
 */
async function fetchVenueById(id) {
  try {
    const list = await apiGet("/venues", { id });
    if (list === undefined) return undefined;
    const v = list[0];
    return v ? { city: v.city || null, country: v.country || null, name: v.name || null, capacity: v.capacity || null } : null;
  } catch {
    return undefined;
  }
}

/**
 * Consulta um time pelo ID: o estádio dele e o país. Devolve
 * { city, country, venueName }, null (time sem estádio no cadastro) ou
 * undefined (a API reclamou).
 */
async function fetchTeamById(id) {
  try {
    const list = await apiGet("/teams", { id });
    if (list === undefined) return undefined;
    const t = list[0];
    return t ? { city: t.venue?.city || null, country: t.team?.country || null, venueName: t.venue?.name || null, venueCapacity: t.venue?.capacity || null } : null;
  } catch {
    return undefined;
  }
}

/**
 * Faz as consultas em lotes de LOOKUP_CONCURRENCY ao mesmo tempo. Se a API
 * reclamar (undefined) em algum, termina o lote e para por aí — o resto
 * fica pra próxima atualização.
 */
export async function lookupMany(ids, fetchOne, store) {
  for (let i = 0; i < ids.length; i += LOOKUP_CONCURRENCY) {
    const chunk = ids.slice(i, i + LOOKUP_CONCURRENCY);
    const results = await Promise.all(chunk.map(async (id) => ({ id, value: await fetchOne(id) })));
    let complained = false;
    for (const { id, value } of results) {
      if (value === undefined) complained = true;
      else await store(id, value);
    }
    if (complained) break;
  }
}

/**
 * A API escreve algumas cidades do jeito errado nos jogos ("Bello
 * Harisanta" por Belo Horizonte), mas no cadastro do estádio, por ID, o
 * nome vem certo. Pros jogos que ficaram sem localização, busca no
 * cadastro — primeiro no nosso banco (venues_cache), depois na API.
 * Nunca derruba a atualização: se algo falhar, devolve o que tiver.
 */
export async function resolveVenueInfo(supabase, apiFixtures) {
  const info = new Map();
  try {
    const ids = venueIdsNeedingLookup(apiFixtures, { findCity, countryCodeFromName });
    if (ids.length === 0) return info;

    const { data: cached, error: cacheError } = await supabase.from("venues_cache").select("venue_id, name, city, country, capacity").in("venue_id", ids);
    if (cacheError) {
      // Sem a tabela (ainda não rodaram o SQL-3?) não adianta consultar a
      // API: a resposta não ficaria guardada e gastaria cota à toa.
      console.error("[gamesSearch] venues_cache indisponível:", cacheError.message);
      return info;
    }
    for (const r of cached || []) info.set(r.venue_id, { city: r.city, country: r.country, name: r.name, capacity: r.capacity });

    const missing = ids.filter((id) => !info.has(id)).slice(0, MAX_VENUE_LOOKUPS_PER_REFRESH);
    await lookupMany(missing, fetchVenueById, async (id, v) => {
      await supabase.from("venues_cache").upsert({
        venue_id: id,
        name: v ? v.name : null,
        city: v ? v.city : null,
        country: v ? v.country : null,
        capacity: v ? v.capacity : null,
        fetched_at: new Date().toISOString(),
      });
      if (v) info.set(id, v);
    });
  } catch (e) {
    console.error("[gamesSearch] consulta de estádios falhou (segue sem ela):", e.message);
  }
  return info;
}

/**
 * Jogo futuro quase nunca vem com ID de estádio, e uns 15% vêm sem nome nem
 * cidade. Pra esses, usa o estádio do TIME DA CASA (que vem limpo no cadastro
 * do time, e é onde a maioria dos jogos acontece). Guardado em
 * team_home_venues — cada time é consultado uma vez só.
 */
export async function resolveHomeTeams(supabase, apiFixtures, venueInfo) {
  const info = new Map();
  try {
    const ids = teamIdsNeedingLookup(apiFixtures, { findCity, countryCodeFromName }, (id) => venueInfo.get(id));
    if (ids.length === 0) return info;

    const { data: cached, error: cacheError } = await supabase.from("team_home_venues").select("team_id, venue_name, venue_city, venue_capacity, country").in("team_id", ids);
    if (cacheError) {
      console.error("[gamesSearch] team_home_venues indisponível:", cacheError.message);
      return info;
    }
    for (const r of cached || []) info.set(r.team_id, { city: r.venue_city, country: r.country, venueName: r.venue_name, venueCapacity: r.venue_capacity });

    const missing = ids.filter((id) => !info.has(id)).slice(0, MAX_TEAM_LOOKUPS_PER_REFRESH);
    await lookupMany(missing, fetchTeamById, async (id, t) => {
      await supabase.from("team_home_venues").upsert({
        team_id: id,
        venue_name: t ? t.venueName : null,
        venue_city: t ? t.city : null,
        venue_capacity: t ? t.venueCapacity : null,
        country: t ? t.country : null,
        fetched_at: new Date().toISOString(),
      });
      if (t) info.set(id, t);
    });
  } catch (e) {
    console.error("[gamesSearch] consulta de times falhou (segue sem ela):", e.message);
  }
  return info;
}
