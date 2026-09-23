import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/webhook
 * O Mercado Pago chama esta URL sozinho quando o status de um
 * pagamento muda. Aqui a gente confirma o pagamento de verdade
 * (nunca confia só no que vem no corpo da notificação) e marca
 * o pedido como pago no banco.
 */
export async function POST(request) {
  const body = await request.json();

  // O Mercado Pago manda vários tipos de evento; só nos importa "payment"
  if (body.type !== "payment") {
    return Response.json({ received: true });
  }

  const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
  const paymentClient = new Payment(client);
  const payment = await paymentClient.get({ id: body.data.id });

  const supabase = supabaseAdmin();

  if (payment.status === "approved") {
    await supabase
      .from("orders")
      .update({ status: "paid", mercadopago_payment_id: payment.id, paid_at: new Date().toISOString() })
      .eq("mercadopago_preference_id", payment.metadata?.preference_id ?? "");
  }

  return Response.json({ received: true });
}
