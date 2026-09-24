import { getFixtures } from "@/lib/footballApi";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/fixtures/sync
 * Chamada automaticamente 1x por dia pela Vercel Cron (ver vercel.json).
 * Também pode ser chamada manualmente com ?token=SEU_CRON_SECRET pra
 * testar antes de configurar o cron.
 *
 * Passo a passo:
 * 1. Lê a tabela `leagues` do Supabase (as ligas que você já configurou).
 * 2. Pra cada uma, busca na API-Football os jogos dos próximos ~120 dias.
 * 3. Grava (upsert) na tabela `fixtures`, usando api_fixture_id como
 *    chave — assim rodar de novo só atualiza o que mudou, sem duplicar.
 *
 * IMPORTANTE: a tabela `leagues` começa vazia. Antes de rodar isso de
 * verdade, primeiro usamos /api/admin/discover-leagues pra achar os IDs
 * certos e inserir as linhas em `leagues` (via SQL Editor do Supabase).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || request.headers.get("authorization")?.replace("Bearer ", "");

  if (token !== process.env.CRON_SECRET) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data: leagues, error: leaguesError } = await supabase
    .from("leagues")
    .select("*")
    .eq("active", true);

  if (leaguesError) {
    return Response.json({ error: leaguesError.message }, { status: 500 });
  }
  if (!leagues || leagues.length === 0) {
    return Response.json({
      warning: "Nenhuma liga configurada ainda na tabela `leagues`. Rode /api/admin/discover-leagues primeiro e insira os IDs encontrados.",
    });
  }

  const today = new Date();
  const from = today.toISOString().split("T")[0];
  const in120Days = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000);
  const to = in120Days.toISOString().split("T")[0];

  const results = [];

  for (const league of leagues) {
    try {
      const fixtures = await getFixtures({
        leagueId: league.api_league_id,
        season: league.api_season,
        from,
        to,
      });

      const rows = fixtures.map((f) => ({
        api_fixture_id: f.fixture.id,
        league_id: league.id,
        country: league.country,
        round: f.league.round,
        match_date: f.fixture.date,
        home_team: f.teams.home.name,
        away_team: f.teams.away.name,
        venue_name: f.fixture.venue?.name || null,
        venue_city: f.fixture.venue?.city || null,
        status: f.fixture.status?.short || null,
        raw: f,
        synced_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from("fixtures")
          .upsert(rows, { onConflict: "api_fixture_id" });
        if (upsertError) throw upsertError;
      }

      results.push({ league: league.name, country: league.country, synced: rows.length });
    } catch (e) {
      results.push({ league: league.name, country: league.country, error: e.message });
    }
  }

  return Response.json({ syncedAt: new Date().toISOString(), results });
}
