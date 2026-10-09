import { supabaseAdmin } from "@/lib/supabase";
import { ensureCalendar, getCandidates, getNearestFor, parseCandidateParams, addDays } from "@/lib/fixturesCalendar";
import { LEAGUE_META, leagueIdsForCountries } from "@/lib/calendarCore";
import { todayInSaoPaulo } from "@/lib/gamesSearchCore";
import { planTrip, favoriteSpecs, specMatchesTeam } from "@/lib/tripPlanner";

export const dynamic = "force-dynamic";
// A primeira consulta de um país lê as ligas dele na API-Football (alguns segundos).
export const maxDuration = 60;

const MAX_POSSIBLE_RETURNED = 200;

/** Devolve no máximo N jogos possíveis: primeiro os do roteiro, depois favoritos e clássicos, depois por data. */
function trimPossible(possible, max) {
  if (possible.length <= max) return possible;
  const rank = (g) => (g.selected ? 0 : g.favorite ? 1 : g.rivalry ? 2 : 3);
  return [...possible].sort((a, b) => rank(a) - rank(b) || a.kickoff.localeCompare(b.kickoff)).slice(0, max).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

/**
 * POST /api/trip/plan
 * Corpo: as respostas do questionário — { countries, dateStart, dateEnd,
 * flexLevel, favoriteTeams, priority, pace, adults, kids, budget }.
 * Devolve { plan } montado só com jogos REAIS (ver lib/tripPlanner.js).
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_BODY", message: "Pedido inválido." }, { status: 400 });
  }
  const today = todayInSaoPaulo();
  const countries = Array.isArray(body.countries) ? body.countries : [];
  const dateStart = typeof body.dateStart === "string" && body.dateStart ? body.dateStart : today;
  const dateEnd = typeof body.dateEnd === "string" && body.dateEnd ? body.dateEnd : addDays(dateStart, 30);

  const params = parseCandidateParams(new URLSearchParams({ countries: countries.join(","), start: dateStart, end: dateEnd, flex: typeof body.flexLevel === "string" ? body.flexLevel : "fixed" }), today);
  if (params.error) return Response.json({ error: "INVALID_PARAMS", message: params.error }, { status: 400 });

  const favoriteTeams = Array.isArray(body.favoriteTeams) ? body.favoriteTeams.filter((t) => typeof t === "string").slice(0, 30) : [];
  const answers = { countries: params.labels, dateStart, dateEnd, flexLevel: params.flex, favoriteTeams, priority: body.priority, pace: body.pace };

  try {
    const supabase = supabaseAdmin();
    const leagueIds = leagueIdsForCountries(params.labels);
    const sync = await ensureCalendar(supabase, leagueIds, { requiredTo: params.to });
    const candidates = await getCandidates(supabase, { labels: params.labels, from: params.from, to: params.to });

    // Jogos reais mais próximos FORA das datas — só buscamos quando a escolha da pessoa ficou sem jogo.
    const outside = {};
    const continentalIds = leagueIds.filter((id) => LEAGUE_META[id]?.type === "continental");
    if (candidates.games.length === 0) {
      outside.window = await getNearestFor(supabase, { labels: params.labels, from: params.from, to: params.to });
    }
    if (answers.priority === "international" && !candidates.games.some((g) => g.competition.type === "continental")) {
      outside.international = await getNearestFor(supabase, { labels: params.labels, leagueIds: continentalIds, from: params.from, to: params.to });
    }
    // Favoritos sem jogo no período: busca o mais próximo — pelo ID (lista fixa) ou pelo nome (time vindo da busca).
    outside.favorites = {};
    for (const spec of favoriteSpecs(favoriteTeams)) {
      const has = candidates.games.some((g) => specMatchesTeam(spec, g.home) || specMatchesTeam(spec, g.away));
      if (!has) {
        outside.favorites[spec.name] = await getNearestFor(supabase, { labels: params.labels, ...(spec.id ? { teamIds: [spec.id] } : { teamNames: [spec.name] }), from: params.from, to: params.to });
      }
    }
    // País pedido sem nenhum jogo no período: mostra os jogos mais próximos DELE (fora das datas).
    outside.countries = {};
    if (params.labels.length >= 2) {
      for (const label of params.labels) {
        if (!candidates.games.some((g) => g.country === label)) {
          outside.countries[label] = await getNearestFor(supabase, { labels: [label], from: params.from, to: params.to });
        }
      }
    }

    const plan = planTrip(answers, candidates, { today, outside });
    plan.possible = trimPossible(plan.possible, MAX_POSSIBLE_RETURNED);

    return Response.json(
      {
        plan,
        sync: {
          leagues: sync.length,
          fromApi: sync.filter((s) => s.source === "api").length,
          fromCache: sync.filter((s) => s.source === "cache").length,
          stale: sync.filter((s) => s.stale).length,
          failed: sync.filter((s) => s.source === "error").length,
          oldest: sync.map((s) => s.fetchedAt).filter(Boolean).sort()[0] || null,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("Erro em /api/trip/plan:", e);
    return Response.json({ error: "SERVER", message: "Não foi possível montar o roteiro agora." }, { status: 500 });
  }
}
