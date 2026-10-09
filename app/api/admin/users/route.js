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

const PASSPORT_LAUNCH_DATE = new Date("2026-09-25T00:00:00Z");

/**
 * GET /api/admin/users?email=admin@tripsz.com
 * Painel administrativo — lista de usuários com nível e status de
 * assinatura reais, calculados a partir dos jogos registrados e da
 * tabela de assinaturas.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUsers = userList?.users || [];

    const { data: subs } = await supabase.from("subscriptions").select("user_id, status").order("created_at", { ascending: false });
    const subByUser = new Map();
    (subs || []).forEach((s) => {
      if (!subByUser.has(s.user_id)) subByUser.set(s.user_id, s.status); // mais recente primeiro
    });

    const { data: games } = await supabase.from("attended_games").select("user_id, stadium, country, competition");
    const gamesByUser = new Map();
    (games || []).forEach((g) => {
      if (!gamesByUser.has(g.user_id)) gamesByUser.set(g.user_id, []);
      gamesByUser.get(g.user_id).push(g);
    });

    const users = authUsers.map((u) => {
      const userGames = gamesByUser.get(u.id) || [];
      const stadiums = new Set(userGames.map((g) => g.stadium).filter(Boolean));
      const countries = new Set(userGames.map((g) => g.country).filter(Boolean));
      const hasChampions = userGames.some((g) => /champions league/i.test(g.competition || ""));
      const completedBadges = [stadiums.size >= 5, countries.size >= 3, hasChampions].filter(Boolean).length;
      const xp = userGames.length * 50 + stadiums.size * 100 + countries.size * 200 + completedBadges * 150;

      const isLegacy = new Date(u.created_at) < PASSPORT_LAUNCH_DATE;
      const subStatus = subByUser.get(u.id);
      let subscriptionLabel = "Nunca assinou";
      if (subStatus === "active") subscriptionLabel = "Ativo";
      else if (subStatus === "cancelled") subscriptionLabel = "Cancelado";
      else if (subStatus === "pending") subscriptionLabel = "Pendente";
      else if (isLegacy) subscriptionLabel = "Legado (grátis)";

      return {
        id: u.id,
        name: u.user_metadata?.name || "Sem nome",
        email: u.email,
        country: u.user_metadata?.country || null,
        createdAt: u.created_at,
        level: tierName(xp),
        xp,
        subscriptionStatus: subscriptionLabel,
        gamesCount: userGames.length,
      };
    });

    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return Response.json({ users, total: users.length });
  } catch (e) {
    console.error("Erro em /api/admin/users:", e);
    return Response.json({ error: e.message || "Não foi possível carregar os usuários." }, { status: 500 });
  }
}
