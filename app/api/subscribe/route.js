import { supabaseAdmin } from "@/lib/supabase";

// A assinatura recorrente usa a API de "Assinaturas" (Preapproval) do
// Mercado Pago — é um produto diferente do Checkout Pro que já usamos
// pra consultoria (que é pagamento único). Chamamos a API REST direto
// com fetch, em vez do SDK deles, pra ter certeza absoluta da estrutura
// da chamada (isso mexe com cobrança recorrente de verdade).
async function mpFetch(path, options = {}) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }
  return data;
}

const PLANS = {
  monthly: { amount: 19.9, frequency: 1, frequency_type: "months", reason: "tripsz Passport — Mensal" },
  annual: { amount: 200.0, frequency: 1, frequency_type: "years", reason: "tripsz Passport — Anual" },
};

/**
 * POST /api/subscribe
 * Recebe { userId, email, plan } — plan é "monthly" ou "annual".
 * Cria a assinatura recorrente no Mercado Pago e devolve o link de
 * checkout (init_point) pra pessoa confirmar o meio de pagamento.
 */
export async function POST(request) {
  try {
    const { userId, email, plan } = await request.json();

    if (!userId || !email) {
      return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
    }
    const cfg = PLANS[plan];
    if (!cfg) {
      return Response.json({ error: "Plano inválido." }, { status: 400 });
    }
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return Response.json({ error: "Pagamentos ainda não foram configurados neste ambiente." }, { status: 503 });
    }
    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      return Response.json({ error: "Variável NEXT_PUBLIC_SITE_URL não configurada." }, { status: 503 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    const preapproval = await mpFetch("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: cfg.reason,
        external_reference: userId,
        payer_email: email,
        back_url: `${siteUrl}/conta/assinatura?status=success`,
        auto_recurring: {
          frequency: cfg.frequency,
          frequency_type: cfg.frequency_type,
          transaction_amount: cfg.amount,
          currency_id: "BRL",
        },
      }),
    });

    const supabase = supabaseAdmin();
    const { error: dbError } = await supabase.from("subscriptions").insert({
      user_id: userId,
      plan,
      status: "pending",
      mercadopago_preapproval_id: preapproval.id,
    });
    if (dbError) {
      console.error("Erro ao salvar assinatura no Supabase:", dbError.message);
    }

    return Response.json({ checkoutUrl: preapproval.init_point });
  } catch (e) {
    console.error("Erro em /api/subscribe:", e);
    return Response.json({ error: e.message || "Não foi possível iniciar a assinatura." }, { status: 500 });
  }
}
