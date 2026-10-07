import { supabaseAdmin } from "@/lib/supabase";
import { ensureCalendar, getCandidates, getNearest, parseCandidateParams } from "@/lib/fixturesCalendar";
import { leagueIdsForCountries } from "@/lib/calendarCore";

export const dynamic = "force-dynamic";
// A primeira consulta de um país lê as ligas dele na API-Football (alguns segundos).
export const maxDuration = 60;

/**
 * GET /api/trip/candidates?countries=Itália,Espanha&start=2026-11-01&end=2026-11-14&flex=some
 *
 * Os jogos REAIS dos países escolhidos entre as datas (com a flexibilidade:
 * fixed = 0, some = ±7, flex = ±21 dias). Se a janela estiver vazia, devolve
 * também os jogos reais mais próximos antes e depois dela.
 * É a base do Montar Viagem; também serve pra conferir os dados.
 */
export async function GET(request) {
  const params = parseCandidateParams(new URL(request.url).searchParams);
  if (params.error) return Response.json({ error: "INVALID_PARAMS", message: params.error }, { status: 400 });

  try {
    const supabase = supabaseAdmin();
    const leagueIds = leagueIdsForCountries(params.labels);
    const sync = await ensureCalendar(supabase, leagueIds, { requiredTo: params.to });
    const { games, unlocated, unlocatedGames } = await getCandidates(supabase, { labels: params.labels, from: params.from, to: params.to });
    const nearest = games.length === 0 ? await getNearest(supabase, { labels: params.labels, from: params.from, to: params.to }) : null;

    const failed = sync.filter((s) => s.source === "error");
    return Response.json(
      {
        window: { start: params.start, end: params.end, flex: params.flex, padDays: params.padDays, from: params.from, to: params.to },
        countries: params.labels,
        total: games.length,
        unlocated,
        unlocatedSample: unlocatedGames.slice(0, 25),
        games,
        nearest,
        sync: {
          leagues: sync.length,
          fromApi: sync.filter((s) => s.source === "api").length,
          fromCache: sync.filter((s) => s.source === "cache").length,
          stale: sync.filter((s) => s.stale).length,
          failed: failed.length,
          oldest: sync.map((s) => s.fetchedAt).filter(Boolean).sort()[0] || null,
          logsFound: sync.logsFound ?? null, // quantos registros de leitura o banco devolveu
          serverNow: new Date().toISOString(),
          // De onde veio cada liga e, quando foi lida na API, por quê (pra conferir o cache).
          details: sync.slice(0, 60).map((s) => ({ liga: s.leagueId, temporada: s.season, origem: s.source, motivo: s.why || null, erro: s.error || null })),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("Erro em /api/trip/candidates:", e);
    return Response.json({ error: "SERVER", message: "Não foi possível carregar os jogos agora." }, { status: 500 });
  }
}
