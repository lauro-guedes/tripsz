import { MercadoPagoConfig, Preference } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/checkout
 * Recebe { userId, tripAnswersId } e devolve o link de pagamento
 * real do Mercado Pago (init_point) para o navegador redirecionar.
 */
export async function POST(request) {
  const { userId, tripAnswersId } = await request.json();

  if (!userId) {
    return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
  }

  const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
  const preference = new Preference(client);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  const result = await preference.create({
    body: {
      items: [
        {
          title: "Desbloqueio do roteiro de futebol — tripsz",
          quantity: 1,
          unit_price: 49.9,
          currency_id: "BRL",
        },
      ],
      back_urls: {
        success: `${siteUrl}/resultado?status=paid`,
        failure: `${siteUrl}/checkout?status=failed`,
        pending: `${siteUrl}/checkout?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${siteUrl}/api/webhook`,
      metadata: { userId, tripAnswersId },
    },
  });

  // Registra o pedido como "pending" até o webhook confirmar o pagamento
  const supabase = supabaseAdmin();
  await supabase.from("orders").insert({
    user_id: userId,
    trip_answers_id: tripAnswersId,
    mercadopago_preference_id: result.id,
    status: "pending",
  });

  return Response.json({ checkoutUrl: result.init_point });
}
