import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabase";

async function mpFetch(path) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
  });
  return res.json();
}

// O Mercado Pago usa status próprios pra assinatura; convertemos pro
// vocabulário que já usamos na nossa tabela `subscriptions`.
function mapSubscriptionStatus(mpStatus) {
  if (mpStatus === "authorized") return "active";
  if (mpStatus === "paused") return "paused";
  if (mpStatus === "cancelled") return "cancelled";
  return "pending";
}

/**
 * POST /api/webhook
 * O Mercado Pago chama esta URL sozinho quando algo muda — pagamento
 * avulso (consultoria) ou status de assinatura recorrente (Passport).
 * Aqui a gente sempre confirma direto na API deles (nunca confia só no
 * que vem no corpo da notificação) antes de atualizar o banco.
 */
export async function POST(request) {
  try {
    const body = await request.json();

    // Avisos de assinatura recorrente (Passport Tripsz)
    if (body.type === "subscription_preapproval" || body.type === "preapproval") {
      const preapprovalId = body.data?.id;
      if (!preapprovalId) return Response.json({ received: true });

      const preapproval = await mpFetch(`/preapproval/${preapprovalId}`);
      const supabase = supabaseAdmin();
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: mapSubscriptionStatus(preapproval.status), updated_at: new Date().toISOString() })
        .eq("mercadopago_preapproval_id", preapprovalId);
      if (error) console.error("Erro ao atualizar status da assinatura:", error.message);

      return Response.json({ received: true });
    }

    // Pagamentos avulsos (ex: consultoria)
    if (body.type !== "payment") {
      return Response.json({ received: true });
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: body.data.id });

    const supabase = supabaseAdmin();
    const tripAnswersId = payment.metadata?.trip_answers_id ?? payment.metadata?.tripAnswersId;

    if (payment.status === "approved" && tripAnswersId) {
      // O Mercado Pago não devolve o ID da preference dentro do
      // pagamento, então casamos pelo trip_answers_id que a gente
      // mesmo mandou no metadata ao criar a preference — e só no
      // pedido mais recente ainda "pending" desse roteiro, pra não
      // marcar como pago um pedido antigo por engano.
      const { error } = await supabase
        .from("orders")
        .update({ status: "paid", mercadopago_payment_id: payment.id, paid_at: new Date().toISOString() })
        .eq("trip_answers_id", tripAnswersId)
        .eq("status", "pending");
      if (error) console.error("Erro ao marcar pedido como pago:", error.message);
    }

    return Response.json({ received: true });
  } catch (e) {
    console.error("Erro em /api/webhook:", e);
    // Devolve 200 mesmo em erro — se devolvermos erro, o Mercado Pago fica
    // reenviando a mesma notificação indefinidamente. O erro já foi logado
    // acima para investigação.
    return Response.json({ received: true });
  }
}
