import { supabaseAdmin } from "@/lib/supabase";

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
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

/**
 * POST /api/subscribe/update-card
 * Recebe { userId, cardTokenId } — o cardTokenId vem do SDK de Secure
 * Fields do Mercado Pago, gerado no navegador (o número/validade/CVV
 * nunca passam por aqui). Troca o cartão da assinatura ativa da pessoa
 * usando o mecanismo oficial deles: PUT /preapproval/{id} com
 * card_token_id.
 */
export async function POST(request) {
  try {
    const { userId, cardTokenId } = await request.json();
    if (!userId || !cardTokenId) {
      return Response.json({ error: "Dados incompletos." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      return Response.json({ error: "Nenhuma assinatura ativa encontrada." }, { status: 404 });
    }

    const updated = await mpFetch(`/preapproval/${sub.mercadopago_preapproval_id}`, {
      method: "PUT",
      body: JSON.stringify({ card_token_id: cardTokenId }),
    });

    await supabase
      .from("subscriptions")
      .update({ payment_method_id: updated.payment_method_id || sub.payment_method_id, updated_at: new Date().toISOString() })
      .eq("id", sub.id);

    return Response.json({ ok: true });
  } catch (e) {
    console.error("Erro em /api/subscribe/update-card:", e);
    return Response.json({ error: e.message || "Não foi possível atualizar o cartão." }, { status: 500 });
  }
}
