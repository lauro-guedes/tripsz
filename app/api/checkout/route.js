import { randomUUID } from "crypto";
import { mpFetch, pixInfo } from "@/lib/mpServer";
import { authUser } from "@/lib/serverAuth";
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
    const user = await authUser(request);
    if (!user) {
      return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
    }
    const userId = user.id; // vem do token conferido, nunca do corpo da requisição
    const { tripAnswersId, scheduledDate, scheduledTime, selectedOption, method, card } = await request.json();
    if (method !== "pix" && method !== "card") {
      return Response.json({ error: "Escolha a forma de pagamento (Pix ou cartão)." }, { status: 400 });
    }
    if (method === "card" && !card?.token) {
      return Response.json({ error: "Dados do cartão incompletos." }, { status: 400 });
    }
    if (!scheduledDate || !scheduledTime) {
      return Response.json({ error: "Escolha uma data e um horário para a consultoria." }, { status: 400 });
    }

    // A consultoria só pode ser contratada depois de escolher uma das opções de roteiro
    // (A, B ou C). Conferimos aqui no servidor — o botão desativado na tela é só conforto.
    // A fonte da verdade é a opção guardada no roteiro; se ela ainda não foi gravada (ex.: a
    // migração não rodou), aceitamos a que veio do navegador, desde que seja válida.
    const VALID_OPTIONS = ["A", "B", "C"];
    let chosenOption = null;
    if (tripAnswersId) {
      const { data: ta } = await supabaseAdmin().from("trip_answers").select("user_id, selected_option").eq("id", tripAnswersId).maybeSingle();
      if (ta && ta.user_id !== userId) {
        return Response.json({ error: "Esse roteiro não pertence à sua conta." }, { status: 403 });
      }
      if (VALID_OPTIONS.includes(ta?.selected_option)) chosenOption = ta.selected_option;
    }
    if (!chosenOption && VALID_OPTIONS.includes(selectedOption)) chosenOption = selectedOption;
    if (!chosenOption) {
      return Response.json({ error: "Escolha uma das opções de roteiro (A, B ou C) antes de contratar a consultoria." }, { status: 400 });
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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const supabase = supabaseAdmin();

    // Desconto de 15% pra quem tem o Passaporte de Estádios (assinante ativo, ou conta
    // antiga de antes da assinatura existir). Calculado aqui no servidor
    // de propósito — nunca confiamos num desconto que viesse do navegador.
    const { data: userRow } = await supabase.auth.admin.getUserById(userId);
    const createdAt = userRow?.user?.created_at;
    const isLegacy = createdAt && new Date(createdAt) < new Date("2026-09-25T00:00:00Z");
    let hasPassport = isLegacy;
    if (!hasPassport) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .eq("status", "active")
        .or(`current_period_end.is.null,current_period_end.gte.${new Date().toISOString().slice(0, 10)}`)
        .limit(1)
        .maybeSingle();
      hasPassport = !!sub;
    }
    const unitPrice = hasPassport ? 127.42 : 149.9;

    const metadata = { user_id: userId, trip_answers_id: tripAnswersId, scheduled_date: scheduledDate, scheduled_time: scheduledTime, selected_option: chosenOption, kind: "consultoria" };
    const common = {
      transaction_amount: unitPrice,
      description: "Consultoria humana — tripsz",
      payer: { email: user.email || card?.payer?.email },
      external_reference: userId,
      metadata,
      notification_url: `${siteUrl}/api/webhook`,
    };
    const body =
      method === "pix"
        ? { ...common, payment_method_id: "pix", date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace("Z", "-00:00") }
        : {
            ...common,
            token: card.token,
            installments: Number(card.installments) || 1,
            payment_method_id: card.payment_method_id,
            ...(card.issuer_id ? { issuer_id: card.issuer_id } : {}),
            payer: { email: user.email || card.payer?.email, ...(card.payer?.identification ? { identification: card.payer.identification } : {}) },
          };

    const payment = await mpFetch("/v1/payments", { method: "POST", headers: { "X-Idempotency-Key": randomUUID() }, body: JSON.stringify(body) });

    // Registra o pedido; o webhook (ou a consulta da tela) confirma o pagamento depois.
    // NUNCA bloqueia o acesso ao roteiro — representa só a compra opcional da consultoria.
    const { error: dbError } = await supabase.from("orders").insert({
      user_id: userId,
      trip_answers_id: tripAnswersId,
      mercadopago_payment_id: String(payment.id),
      status: payment.status === "approved" ? "paid" : payment.status === "rejected" ? "cancelled" : "pending",
      paid_at: payment.status === "approved" ? new Date().toISOString() : null,
      item_type: "consultoria",
      amount_cents: Math.round(unitPrice * 100),
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
    });
    if (dbError) console.error("Erro ao salvar pedido no Supabase:", dbError.message);

    if (method === "pix") return Response.json(pixInfo(payment));
    return Response.json({ status: payment.status, statusDetail: payment.status_detail || null });
  } catch (e) {
    console.error("Erro em /api/checkout:", e);
    return Response.json(
      { error: e.message || "Não foi possível iniciar o pagamento. Tente novamente." },
      { status: 500 }
    );
  }
}
