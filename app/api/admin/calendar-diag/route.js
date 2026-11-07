import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/admin/calendar-diag?league=98&season=2026&from=2026-11-07&to=2026-11-20 — só admin.
 * Pergunta à API-Football como ela vê aquela liga (sem gravar nada): quantos jogos, nome/país da competição,
 * eventuais erros e a cota que sobra no dia. Serve pra descobrir ID errado ou limite estourado.
 */
export async function GET(request) {
  if (!(await requireAdmin(request))) return Response.json({ error: "Acesso não autorizado." }, { status: 403, headers: NO_STORE });
  const q = new URL(request.url).searchParams;
  const league = Number(q.get("league"));
  const season = Number(q.get("season")) || new Date().getFullYear();
  if (!Number.isInteger(league) || league <= 0) return Response.json({ error: "league inválida" }, { status: 400, headers: NO_STORE });
  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("league", String(league));
  url.searchParams.set("season", String(season));
  for (const k of ["from", "to"]) if (/^\d{4}-\d{2}-\d{2}$/.test(q.get(k) || "")) url.searchParams.set(k, q.get(k));
  try {
    const res = await fetch(url.toString(), { headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY }, cache: "no-store" });
    const data = await res.json();
    const list = data.response || [];
    const leagues = [...new Set(list.map((f) => `${f.league && f.league.id} · ${f.league && f.league.name} · ${f.league && f.league.country}`))];
    return Response.json({
      httpStatus: res.status,
      errors: data.errors || null,
      results: list.length,
      leagues,
      firstGames: list.slice(0, 5).map((f) => ({ date: f.fixture.date, home: f.teams.home.name, away: f.teams.away.name, venue: f.fixture.venue && f.fixture.venue.name })),
      quota: { limitDay: res.headers.get("x-ratelimit-requests-limit"), remainingDay: res.headers.get("x-ratelimit-requests-remaining"), perMinute: res.headers.get("x-ratelimit-limit") },
    }, { headers: NO_STORE });
  } catch (e) {
    return Response.json({ error: "fetch", message: String(e && e.message).slice(0, 200) }, { status: 502, headers: NO_STORE });
  }
}
