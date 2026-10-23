/**
 * Check-in por GPS: a pessoa manda onde está e a gente responde se ela está
 * num estádio com jogo começando em até 3 horas (ou que começou há até 3 horas).
 * Só devolve jogos que ela ainda não tem no Passaporte.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authUser } from "@/lib/serverAuth";
import { distanceMeters } from "@/lib/geo";
import { getVenueCoords } from "@/lib/venueGeo";
import { isPlayable, labelForRow } from "@/lib/calendarCore";

export const dynamic = "force-dynamic";

const WINDOW_MS = 3 * 60 * 60 * 1000; // 3h antes do jogo (e 3h depois do apito inicial)
const CITY_RADIUS_M = 50000; // só consulta estádio de jogo em até 50 km da pessoa
const AT_STADIUM_M = 700; // "está no estádio" = até 700 m do ponto do estádio
const MAX_CANDIDATES = 8;

export async function POST(request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Faça login." }, { status: 401 });

  let body = {};
  try { body = await request.json(); } catch { /* corpo vazio */ }
  const lat = Number(body.lat), lon = Number(body.lon), accuracy = Number(body.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ ok: false, error: "Localização inválida." }, { status: 400 });
  }
  // GPS muito impreciso (ex.: só Wi-Fi/antena, a km de distância) não serve pra dizer que está no estádio.
  if (Number.isFinite(accuracy) && accuracy > 1500) return NextResponse.json({ ok: true, games: [], reason: "low-accuracy" });

  const supabase = supabaseAdmin();
  const now = Date.now();
  const { data: rows, error } = await supabase
    .from("fixtures_calendar")
    .select("*")
    .gte("kickoff", new Date(now - WINDOW_MS).toISOString())
    .lte("kickoff", new Date(now + WINDOW_MS).toISOString())
    .not("lat", "is", null)
    .not("lon", "is", null);
  if (error) return NextResponse.json({ ok: false, error: "Falha ao consultar jogos." }, { status: 500 });

  const near = (rows || [])
    .filter((r) => isPlayable(r.status) && r.venue_name && distanceMeters(lat, lon, r.lat, r.lon) <= CITY_RADIUS_M)
    .sort((a, b) => distanceMeters(lat, lon, a.lat, a.lon) - distanceMeters(lat, lon, b.lat, b.lon))
    .slice(0, MAX_CANDIDATES);
  if (near.length === 0) return NextResponse.json({ ok: true, games: [] });

  const { data: already } = await supabase.from("attended_games").select("api_fixture_id").eq("user_id", user.id).in("api_fixture_id", near.map((r) => r.fixture_id));
  const have = new Set((already || []).map((a) => Number(a.api_fixture_id)));

  const slack = Number.isFinite(accuracy) ? Math.min(accuracy, 300) : 0;
  const games = [];
  const venueDone = new Map(); // vários jogos no mesmo estádio: consulta uma vez
  for (const r of near) {
    if (have.has(Number(r.fixture_id))) continue;
    const vk = `${r.venue_name}|${r.venue_city}`;
    if (!venueDone.has(vk)) venueDone.set(vk, await getVenueCoords(supabase, r.venue_name, r.venue_city, { lat: r.lat, lon: r.lon }));
    const v = venueDone.get(vk);
    if (!v) continue;
    const dist = distanceMeters(lat, lon, v.lat, v.lon);
    if (dist > AT_STADIUM_M + slack) continue;
    games.push({
      fixtureId: r.fixture_id,
      kickoff: r.kickoff,
      matchDate: r.match_date,
      home: r.home_team,
      away: r.away_team,
      homeLogo: r.home_logo,
      awayLogo: r.away_logo,
      competition: r.league_name,
      stadium: r.venue_name,
      city: r.venue_city,
      country: labelForRow(r) || r.league_country || "",
      distance: Math.round(dist),
    });
  }
  games.sort((a, b) => Math.abs(new Date(a.kickoff) - now) - Math.abs(new Date(b.kickoff) - now));
  return NextResponse.json({ ok: true, games });
}
