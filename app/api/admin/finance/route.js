import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/finance?email=admin@tripsz.com
 *
 * Painel administrativo — Financeiro, versão SIMPLIFICADA. Combina o
 * que já calculamos em Assinaturas + Consultorias num resumo só. Não
 * tem gráfico de receita ao longo do tempo porque não guardamos um
 * snapshot histórico disso — só o estado atual das tabelas.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: subs } = await supabase.from("subscriptions").select("status, plan, created_at");
    const allSubs = subs || [];
    const active = allSubs.filter((s) => s.status === "active");
    const cancelled = allSubs.filter((s) => s.status === "cancelled");
    const mrr = active.reduce((sum, s) => sum + (s.plan === "annual" ? 99.9 / 12 : 9.9), 0);
    const arr = mrr * 12;

    const { data: orders } = await supabase.from("orders").select("status, amount_cents, item_type, created_at");
    const paidOrders = (orders || []).filter((o) => o.status === "paid");
    const consultingRevenue = paidOrders
      .filter((o) => o.item_type === "consultoria")
      .reduce((sum, o) => sum + (o.amount_cents || 0), 0) / 100;

    const totalRevenue = (mrr * 1) + consultingRevenue; // receita "do mês corrente" combinada, de forma simplificada

    // Receita por mês, últimos 6 meses — baseada em quando cada
    // assinatura/pedido foi CRIADO (não é um histórico de faturamento
    // real, é uma aproximação a partir do que já temos).
    const now = new Date();
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleDateString("pt-BR", { month: "short" });
      const newSubsThisMonth = allSubs.filter((s) => (s.created_at || "").startsWith(monthKey));
      const ordersThisMonth = paidOrders.filter((o) => (o.created_at || "").startsWith(monthKey) && o.item_type === "consultoria");
      const subsRevenue = newSubsThisMonth.reduce((sum, s) => sum + (s.plan === "annual" ? 99.9 : 9.9), 0);
      const consultRevenue = ordersThisMonth.reduce((sum, o) => sum + (o.amount_cents || 0), 0) / 100;
      monthly.push({ month: monthLabel, revenue: Math.round((subsRevenue + consultRevenue) * 100) / 100 });
    }

    return Response.json({
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      consultingRevenue,
      activeSubscribers: active.length,
      cancelledSubscribers: cancelled.length,
      monthlyRevenue: monthly,
    });
  } catch (e) {
    console.error("Erro em /api/admin/finance:", e);
    return Response.json({ error: e.message || "Não foi possível carregar os dados financeiros." }, { status: 500 });
  }
}
