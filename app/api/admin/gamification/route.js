import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

function tierName(xp) {
  if (xp >= 20000) return "Lenda";
  if (xp >= 5000) return "Veterano";
  if (xp >= 1500) return "Groundhopper";
  if (xp >= 500) return "Estreante";
  return "Torcedor de Sofá";
}

// Calcula o XP/estatísticas de cada usuário a partir de uma lista de
// jogos — usado duas vezes: uma com TODOS os jogos (hoje), outra só com
// os jogos registrados até 30 dias atrás (pra comparar o crescimento
// real, sem inventar nenhuma variação).
function computeRanking(games, usersById) {
  const byUser = new Map();
  games.forEach((g) => {
    if (!byUser.has(g.user_id)) byUser.set(g.user_id, []);
    byUser.get(g.user_id).push(g);
  });

  const ranking = [];
  for (const [uid, userGames] of byUser) {
    const user = usersById.get(uid);
    if (!user) continue;

    const stadiums = new Set(userGames.map((g) => g.stadium).filter(Boolean));
    const countries = new Set(userGames.map((g) => g.country).filter(Boolean));
    const hasChampions = userGames.some((g) => /champions league/i.test(g.competition || ""));
    const completedBadges = [stadiums.size >= 5, countries.size >= 3, hasChampions].filter(Boolean).length;
    const baseXp = userGames.length * 50 + stadiums.size * 100 + countries.size * 200 + completedBadges * 150;
    const xp = baseXp + (user.user_metadata?.xp_adjustment || 0);

    ranking.push({
      userId: uid,
      name: user.user_metadata?.name || "Sem nome",
      email: user.email,
      country: user.user_metadata?.country || "—",
      tier: tierName(xp),
      xp,
      gamesCount: userGames.length,
      stadiumsCount: stadiums.size,
      countriesCount: countries.size,
    });
  }

  ranking.sort((a, b) => b.xp - a.xp);
  ranking.forEach((r, i) => { r.position = i + 1; });
  return ranking;
}

// Variação percentual real entre dois valores — devolve null quando não
// dá pra calcular direito (era zero antes), em vez de mostrar um número
// enganoso tipo "∞%".
function growthPct(now, before) {
  if (before === 0) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

/**
 * GET /api/admin/gamification?email=admin@tripsz.com
 * Painel administrativo — ranking completo, pódio e crescimento real
 * (comparado com 30 dias atrás, usando a data em que cada jogo foi
 * registrado — nunca um número inventado).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: allGames } = await supabase
      .from("attended_games")
      .select("user_id, stadium, country, competition, home_team, away_team, created_at");
    const games = allGames || [];

    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const usersById = new Map((userList?.users || []).map((u) => [u.id, u]));

    const ranking = computeRanking(games, usersById);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const gamesBefore = games.filter((g) => g.created_at && g.created_at <= thirtyDaysAgo);
    const rankingBefore = computeRanking(gamesBefore, usersById);

    const totalXp = ranking.reduce((sum, r) => sum + r.xp, 0);
    const totalXpBefore = rankingBefore.reduce((sum, r) => sum + r.xp, 0);
    const totalGames = ranking.reduce((sum, r) => sum + r.gamesCount, 0);
    const totalGamesBefore = gamesBefore.length;

    const membersGrowth = growthPct(ranking.length, rankingBefore.length);
    const xpGrowth = growthPct(totalXp, totalXpBefore);
    const gamesGrowth = growthPct(totalGames, totalGamesBefore);

    const matchupCounts = {};
    games.forEach((g) => {
      if (!g.home_team || !g.away_team) return;
      const key = [g.home_team, g.away_team].sort().join(" × ");
      matchupCounts[key] = (matchupCounts[key] || 0) + 1;
    });
    const topMatchups = Object.entries(matchupCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return Response.json({
      ranking,
      total: ranking.length,
      totalXp,
      totalGames,
      topMatchups,
      membersGrowth,
      xpGrowth,
      gamesGrowth,
      podium: ranking.slice(0, 3),
    });
  } catch (e) {
    console.error("Erro em /api/admin/gamification:", e);
    return Response.json({ error: e.message || "Não foi possível carregar o ranking." }, { status: 500 });
  }
}
