/**
 * tripsz.social (Fase 2) — check-in: quais estádios estão perto de quem pede e se a pessoa ESTÁ num deles (SÓ no servidor).
 * Mesma base do check-in por GPS do app (calendário de jogos + coordenadas do estádio, raio de 700 m).
 */
import { isPlayable } from "./calendarCore";
import { distanceMeters } from "./geo";
import { AT_STADIUM_M } from "./socialPostRules";
import { fail, must } from "./socialShared";
import { getVenueCoords, venueKey } from "./venueGeo";

const BOX_DEG = 0.5; // ~55 km: só olha estádios dessa caixa em volta da pessoa
const LIST_M = 5000; // aparecem na lista os estádios a até 5 km
const MAX_VENUES = 8;
const GAME_WINDOW_MS = 3 * 3600 * 1000; // jogo "agora" = começa em até 3 h ou começou há até 3 h
const MAX_ACCURACY_M = 1500;

/**
 * Estádios perto de (lat, lon), do mais perto pro mais longe. `atStadium`: está a até 700 m (mais a imprecisão do GPS, até 300 m).
 * Cada estádio traz os jogos de agora (`games`). Devolve { ok, stadiums } ou um erro (localização inválida / GPS impreciso).
 */
export async function stadiumsNear(supabase, { lat, lon, accuracy, now = Date.now() }) {
  // null, texto vazio e verdadeiro/falso NÃO são coordenadas (Number(null) daria 0, o ponto no meio do oceano)
  const toNum = (v) => (v === null || v === "" || typeof v === "boolean" ? NaN : Number(v));
  lat = toNum(lat);
  lon = toNum(lon);
  accuracy = toNum(accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return fail("invalid_field", "Localização inválida.");
  if (Number.isFinite(accuracy) && accuracy > MAX_ACCURACY_M) return fail("low_accuracy");
  const { data } = must(
    await supabase.from("fixtures_calendar").select("venue_name, venue_city, lat, lon, league_country, league_name, fixture_id, kickoff, status, home_team, away_team, home_logo, away_logo").gte("lat", lat - BOX_DEG).lte("lat", lat + BOX_DEG).gte("lon", lon - BOX_DEG * 1.2).lte("lon", lon + BOX_DEG * 1.2).not("venue_name", "is", null).limit(1500)
  );
  const venues = new Map();
  for (const r of data || []) {
    const key = venueKey(r.venue_name, r.venue_city);
    const v = venues.get(key) || { key, name: r.venue_name, city: r.venue_city || null, country: r.league_country || null, lat: r.lat, lon: r.lon, rows: [] };
    v.rows.push(r);
    venues.set(key, v);
  }
  const slack = Number.isFinite(accuracy) ? Math.min(accuracy, 300) : 0;
  const near = [...venues.values()].map((v) => ({ v, d: distanceMeters(lat, lon, v.lat, v.lon) })).sort((a, b) => a.d - b.d).slice(0, MAX_VENUES);
  const stadiums = [];
  for (const { v } of near) {
    const c = await getVenueCoords(supabase, v.name, v.city, { lat: v.lat, lon: v.lon }); // ponto exato do estádio (a cidade só serve de pista)
    if (!c) continue;
    const dist = distanceMeters(lat, lon, c.lat, c.lon);
    if (dist > LIST_M) continue;
    const games = v.rows
      .filter((r) => isPlayable(r.status) && Math.abs(new Date(r.kickoff).getTime() - now) <= GAME_WINDOW_MS)
      .sort((a, b) => Math.abs(new Date(a.kickoff) - now) - Math.abs(new Date(b.kickoff) - now))
      .map((r) => ({ fixtureId: r.fixture_id, kickoff: r.kickoff, home: r.home_team, away: r.away_team, competition: r.league_name }));
    stadiums.push({ key: v.key, name: v.name, city: v.city, country: v.country, distance: Math.round(dist), atStadium: dist <= AT_STADIUM_M + slack, games });
  }
  stadiums.sort((a, b) => a.distance - b.distance);
  return { ok: true, stadiums };
}
