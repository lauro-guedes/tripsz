import { MercadoPagoConfig, Preference } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/checkout
 * Recebe { userId, tripAnswersId, scheduledDate, scheduledTime } e devolve
 * o link de pagamento real do Mercado Pago (init_point) para o navegador
 * redirecionar.
 *
 * IMPORTANTE — mudança de modelo: o roteiro em si (jogos possíveis,
 * cidades, planejamento dia a dia) é gratuito e já vem desbloqueado assim
 * que a pessoa preenche o questionário. O que este checkout vende agora é
 * a CONSULTORIA HUMANA opcional (R$ 149,90), com uma sessão agendada.
 */
export async function POST(request) {
  try {
    const { userId, tripAnswersId, scheduledDate, scheduledTime } = await request.json();

    if (!userId) {
      return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
    }
    if (!scheduledDate || !scheduledTime) {
      return Response.json({ error: "Escolha uma data e um horário para a consultoria." }, { status: 400 });
    }

    // Sem essas duas variáveis configuradas na Vercel, o Mercado Pago
    // não tem como gerar o link de pagamento. Falhar aqui com uma
    // mensagem clara é melhor do que deixar o SDK quebrar sem explicação.
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return Response.json(
        { error: "Pagamentos ainda não foram configurados neste ambiente (falta MERCADOPAGO_ACCESS_TOKEN)." },
        { status: 503 }
      );
    }
    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      return Response.json(
        { error: "Variável NEXT_PUBLIC_SITE_URL não configurada." },
        { status: 503 }
      );
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const preference = new Preference(client);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    const result = await preference.create({
      body: {
        items: [
          {
            title: "Consultoria humana — tripsz",
            quantity: 1,
            unit_price: 149.9,
            currency_id: "BRL",
          },
        ],
        back_urls: {
          success: `${siteUrl}/conta/roteiros/detalhe?status=paid`,
          failure: `${siteUrl}/checkout?status=failed`,
          pending: `${siteUrl}/checkout?status=pending`,
        },
        auto_return: "approved",
        notification_url: `${siteUrl}/api/webhook`,
        metadata: { userId, tripAnswersId, scheduledDate, scheduledTime },
      },
    });

    // Registra o agendamento como "pending" até o webhook confirmar o
    // pagamento. Diferente de antes, isto NUNCA bloqueia o acesso ao
    // roteiro — só representa a compra opcional da consultoria.
    const supabase = supabaseAdmin();
    const { error: dbError } = await supabase.from("orders").insert({
      user_id: userId,
      trip_answers_id: tripAnswersId,
      mercadopago_preference_id: result.id,
      status: "pending",
      item_type: "consultoria",
      amount_cents: 14990,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
    });
    if (dbError) {
      console.error("Erro ao salvar pedido no Supabase:", dbError.message);
      // Não bloqueia o pagamento por causa disso — o webhook confirma o
      // status depois; só registramos o erro para investigar.
    }

    return Response.json({ checkoutUrl: result.init_point });
  } catch (e) {
    console.error("Erro em /api/checkout:", e);
    return Response.json(
      { error: e.message || "Não foi possível iniciar o pagamento. Tente novamente." },
      { status: 500 }
    );
  }
}
