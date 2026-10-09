import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

// Lista de e-mails com acesso ao painel administrativo — configurada na
// Vercel (variável ADMIN_EMAILS, separados por vírgula). Sem isso,
// ninguém entra no painel, nem por engano.
/**
 * GET /api/admin/overview?email=admin@tripsz.com
 *
 * Painel administrativo — Visão Geral. Só devolve dado nenhum se o
 * e-mail informado estiver na lista de administradores (ADMIN_EMAILS).
 * Todos os números aqui vêm direto do banco, nada é inventado.
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
    const users = userList?.users || [];
    const totalUsers = users.length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: subs } = await supabase.from("subscriptions").select("status, plan");
    const activeSubs = (subs || []).filter((s) => s.status === "active");
    const mrr = activeSubs.reduce((sum, s) => sum + (s.plan === "annual" ? 99.9 / 12 : 9.9), 0);

    const { count: tripsThisMonth } = await supabase
      .from("trip_answers")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth);

    const { count: gamesThisMonth } = await supabase
      .from("attended_games")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth);

    const { data: orders } = await supabase.from("orders").select("status, amount_cents");
    const paidOrders = (orders || []).filter((o) => o.status === "paid");
    const consultingRevenue = paidOrders.reduce((sum, o) => sum + (o.amount_cents || 0), 0) / 100;

    // Novos usuários por dia, últimos 14 dias — pro gráfico de crescimento.
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
    const recentUsers = users.filter((u) => new Date(u.created_at) >= fourteenDaysAgo);
    const byDay = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(fourteenDaysAgo.getTime() + i * 86400000);
      byDay[d.toISOString().slice(0, 10)] = 0;
    }
    recentUsers.forEach((u) => {
      const day = new Date(u.created_at).toISOString().slice(0, 10);
      if (byDay[day] !== undefined) byDay[day] += 1;
    });
    const newUsersByDay = Object.entries(byDay).map(([date, count]) => ({ date, count }));

    return Response.json({
      totalUsers,
      activeSubscribers: activeSubs.length,
      mrr: Math.round(mrr * 100) / 100,
      tripsThisMonth: tripsThisMonth || 0,
      gamesThisMonth: gamesThisMonth || 0,
      consultingRevenue,
      newUsersByDay,
    });
  } catch (e) {
    console.error("Erro em /api/admin/overview:", e);
    return Response.json({ error: e.message || "Não foi possível carregar os dados." }, { status: 500 });
  }
}
