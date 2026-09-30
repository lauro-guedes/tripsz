import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAdminEmail(email) {
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.toLowerCase());
}

function tierName(xp) {
  if (xp >= 20000) return "Lenda";
  if (xp >= 5000) return "Veterano";
  if (xp >= 1500) return "Groundhopper";
  if (xp >= 500) return "Estreante";
  return "Torcedor de Sofá";
}

/**
 * GET /api/admin/gamification?email=admin@tripsz.com
 * Painel administrativo — ranking completo, só leitura, pra conferência.
 * Mesma fórmula de XP usada no Ranking que os usuários veem.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!isAdminEmail(email)) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: games } = await supabase.from("attended_games").select("user_id, stadium, country, competition");
    const byUser = new Map();
    (games || []).forEach((g) => {
      if (!byUser.has(g.user_id)) byUser.set(g.user_id, []);
      byUser.get(g.user_id).push(g);
    });

    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const usersById = new Map((userList?.users || []).map((u) => [u.id, u]));

    const ranking = [];
    for (const [uid, userGames] of byUser) {
      const user = usersById.get(uid);
      if (!user) continue;

      const stadiums = new Set(userGames.map((g) => g.stadium).filter(Boolean));
      const countries = new Set(userGames.map((g) => g.country).filter(Boolean));
      const hasChampions = userGames.some((g) => /champions league/i.test(g.competition || ""));
      const completedBadges = [stadiums.size >= 5, countries.size >= 3, hasChampions].filter(Boolean).length;
      const xp = userGames.length * 50 + stadiums.size * 100 + countries.size * 200 + completedBadges * 150;

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

    return Response.json({ ranking, total: ranking.length });
  } catch (e) {
    console.error("Erro em /api/admin/gamification:", e);
    return Response.json({ error: e.message || "Não foi possível carregar o ranking." }, { status: 500 });
  }
}
