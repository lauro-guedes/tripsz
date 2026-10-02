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

async function mpFetch(path) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

/**
 * GET /api/admin/subscriptions/detail?email=admin@tripsz.com&subscriptionId=UUID
 * Painel administrativo — detalhe de uma assinatura, com histórico de
 * faturas real, direto do Mercado Pago (mesma fonte que a pessoa vê na
 * própria tela de assinatura dela).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const subscriptionId = searchParams.get("subscriptionId");

  if (!isAdminEmail(email)) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }
  if (!subscriptionId) {
    return Response.json({ error: "subscriptionId é obrigatório." }, { status: 400 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (subError || !sub) {
      return Response.json({ error: "Assinatura não encontrada." }, { status: 404 });
    }

    const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
    const user = userData?.user;

    let invoices = [];
    if (sub.mercadopago_preapproval_id) {
      try {
        const result = await mpFetch(`/authorized_payments/search?preapproval_id=${sub.mercadopago_preapproval_id}`);
        invoices = (result.results || [])
          .map((inv) => ({ date: inv.date_created, amount: inv.transaction_amount, status: inv.status }))
          .sort((a, b) => new Date(b.date) - new Date(a.date));
      } catch {
        invoices = [];
      }
    }

    return Response.json({
      id: sub.id,
      userName: user?.user_metadata?.name || "Sem nome",
      userEmail: user?.email || "—",
      plan: sub.plan === "annual" ? "Anual" : "Mensal",
      status: sub.status,
      amount: sub.plan === "annual" ? 99.9 : 9.9,
      currentPeriodEnd: sub.current_period_end,
      paymentMethod: PAYMENT_METHOD_NAMES[sub.payment_method_id] || sub.payment_method_id || "—",
      createdAt: sub.created_at,
      invoices,
    });
  } catch (e) {
    console.error("Erro em /api/admin/subscriptions/detail:", e);
    return Response.json({ error: e.message || "Não foi possível carregar a assinatura." }, { status: 500 });
  }
}
