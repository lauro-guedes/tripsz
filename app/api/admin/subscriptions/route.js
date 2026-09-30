import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAdminEmail(email) {
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.toLowerCase());
}

const PAYMENT_METHOD_NAMES = {
  visa: "Visa", master: "Mastercard", amex: "American Express", elo: "Elo",
  hipercard: "Hipercard", diners: "Diners Club", account_money: "Saldo Mercado Pago", pix: "Pix",
};

/**
 * GET /api/admin/subscriptions?email=admin@tripsz.com
 * Painel administrativo — assinaturas, MRR e taxa de cancelamento reais,
 * direto da tabela subscriptions.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!isAdminEmail(email)) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: subs } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
    const allSubs = subs || [];

    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const usersById = new Map((userList?.users || []).map((u) => [u.id, u]));

    const rows = allSubs.map((s) => {
      const user = usersById.get(s.user_id);
      return {
        id: s.id,
        userName: user?.user_metadata?.name || "Sem nome",
        userEmail: user?.email || "—",
        plan: s.plan === "annual" ? "Anual" : "Mensal",
        status: s.status,
        currentPeriodEnd: s.current_period_end,
        paymentMethod: PAYMENT_METHOD_NAMES[s.payment_method_id] || s.payment_method_id || "—",
        createdAt: s.created_at,
      };
    });

    const active = allSubs.filter((s) => s.status === "active");
    const cancelled = allSubs.filter((s) => s.status === "cancelled");
    const mrr = active.reduce((sum, s) => sum + (s.plan === "annual" ? 200 / 12 : 19.9), 0);
    // Churn simples: cancelados sobre o total de assinaturas que já
    // existiram (ativas + canceladas) — não conta pendentes, que nunca
    // chegaram a virar assinante de verdade.
    const everSubscribed = active.length + cancelled.length;
    const churnRate = everSubscribed > 0 ? (cancelled.length / everSubscribed) * 100 : 0;

    const monthlyCount = active.filter((s) => s.plan !== "annual").length;
    const annualCount = active.filter((s) => s.plan === "annual").length;

    return Response.json({
      subscriptions: rows,
      mrr: Math.round(mrr * 100) / 100,
      churnRate: Math.round(churnRate * 10) / 10,
      monthlyCount,
      annualCount,
      activeCount: active.length,
    });
  } catch (e) {
    console.error("Erro em /api/admin/subscriptions:", e);
    return Response.json({ error: e.message || "Não foi possível carregar as assinaturas." }, { status: 500 });
  }
}
