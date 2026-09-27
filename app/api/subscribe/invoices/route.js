import { supabaseAdmin } from "@/lib/supabase";

async function mpFetch(path) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

/**
 * GET /api/subscribe/invoices?userId=UUID
 *
 * Busca o histórico real de faturas da assinatura do usuário, direto na
 * API do Mercado Pago (/authorized_payments/search) — sem inventar
 * nenhuma linha. Se a pessoa já trocou de plano antes (cancelou um e
 * assinou outro), busca as faturas de TODAS as assinaturas que ela já
 * teve, não só da atual.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "Usuário não informado." }, { status: 400 });
  }

  try {
    const supabase = supabaseAdmin();
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("plan, mercadopago_preapproval_id")
      .eq("user_id", userId);

    if (!subs || subs.length === 0) {
      return Response.json({ invoices: [] });
    }

    const planByPreapproval = Object.fromEntries(subs.map((s) => [s.mercadopago_preapproval_id, s.plan]));

    const results = await Promise.all(
      subs.map((s) => mpFetch(`/authorized_payments/search?preapproval_id=${s.mercadopago_preapproval_id}`).catch(() => ({ results: [] })))
    );

    const invoices = results
      .flatMap((r) => r.results || [])
      .map((inv) => ({
        date: inv.date_created,
        plan: planByPreapproval[inv.preapproval_id] === "annual" ? "Plano Assinante — Anual" : "Plano Assinante — Mensal",
        amount: inv.transaction_amount,
        status: inv.status,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return Response.json({ invoices });
  } catch (e) {
    console.error("Erro em /api/subscribe/invoices:", e);
    return Response.json({ error: e.message || "Não foi possível buscar o histórico de faturas." }, { status: 500 });
  }
}
