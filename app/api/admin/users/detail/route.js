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

const PASSPORT_LAUNCH_DATE = new Date("2026-09-25T00:00:00Z");

/**
 * GET /api/admin/users/detail?email=admin@tripsz.com&userId=UUID
 * Painel administrativo — perfil completo de um usuário específico,
 * só leitura. Mesmos cálculos de XP/nível usados no resto do app.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const userId = searchParams.get("userId");

  if (!isAdminEmail(email)) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }
  if (!userId) {
    return Response.json({ error: "userId é obrigatório." }, { status: 400 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    }
    const user = userData.user;

    const { data: games } = await supabase
      .from("attended_games")
      .select("*")
      .eq("user_id", userId)
      .order("match_date", { ascending: false });
    const allGames = games || [];

    const stadiums = new Set(allGames.map((g) => g.stadium).filter(Boolean));
    const countries = new Set(allGames.map((g) => g.country).filter(Boolean));
    const hasChampions = allGames.some((g) => /champions league/i.test(g.competition || ""));
    const completedBadges = [stadiums.size >= 5, countries.size >= 3, hasChampions].filter(Boolean).length;
    const baseXp = allGames.length * 50 + stadiums.size * 100 + countries.size * 200 + completedBadges * 150;
    const xpAdjustment = user.user_metadata?.xp_adjustment || 0;
    const xp = baseXp + xpAdjustment;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const isLegacy = new Date(user.created_at) < PASSPORT_LAUNCH_DATE;
    let subscriptionLabel = "Nunca assinou";
    if (sub?.status === "active") subscriptionLabel = "Ativo";
    else if (sub?.status === "cancelled") subscriptionLabel = "Cancelado";
    else if (sub?.status === "pending") subscriptionLabel = "Pendente";
    else if (isLegacy) subscriptionLabel = "Legado (grátis)";

    const { data: publicProfile } = await supabase
      .from("public_profiles")
      .select("slug")
      .eq("user_id", userId)
      .maybeSingle();

    // Eventos — derivados do que realmente temos (sem log de atividade
    // genérico, então montamos a partir dos registros reais).
    const events = [];
    events.push({ label: "Conta criada", date: user.created_at });
    if (sub) events.push({ label: `Assinatura ${sub.plan === "annual" ? "anual" : "mensal"} iniciada`, date: sub.created_at });
    if (allGames.length > 0) events.push({ label: `Primeiro jogo registrado`, date: allGames[allGames.length - 1].created_at });
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    return Response.json({
      id: user.id,
      name: user.user_metadata?.name || "Sem nome",
      email: user.email,
      country: user.user_metadata?.country || null,
      favoriteTeams: user.user_metadata?.favorite_teams || [],
      createdAt: user.created_at,
      emailConfirmed: !!user.email_confirmed_at,
      isSuspended: !!user.banned_until && new Date(user.banned_until) > new Date(),
      subscriptionStatus: subscriptionLabel,
      subscriptionPlan: sub?.plan || null,
      publicProfileSlug: publicProfile?.slug || null,
      stats: {
        gamesCount: allGames.length,
        stadiumsCount: stadiums.size,
        countriesCount: countries.size,
        baseXp,
        xpAdjustment,
        xpAdjustmentReason: user.user_metadata?.xp_adjustment_reason || null,
        xp,
        tier: tierName(xp),
      },
      games: allGames.slice(0, 50).map((g) => ({
        id: g.id,
        home: g.home_team,
        away: g.away_team,
        homeScore: g.home_score,
        awayScore: g.away_score,
        date: g.match_date,
        stadium: g.stadium,
        country: g.country,
        competition: g.competition,
        source: g.source,
      })),
      events,
    });
  } catch (e) {
    console.error("Erro em /api/admin/users/detail:", e);
    return Response.json({ error: e.message || "Não foi possível carregar o perfil." }, { status: 500 });
  }
}
