import { randomUUID } from "crypto";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { activatePixPassport, mpFetch, paymentUserOk, pixInfo } from "@/lib/mpServer";

const ANNUAL_PRICE = 99.9;

/**
 * POST /api/subscribe/pix — gera um Pix do plano anual (R$ 99,90, acesso por 365 dias,
 * sem renovação automática). Devolve o QR Code para a tela mostrar.
 */
export async function POST(request) {
  try {
    const user = await authUser(request);
    if (!user) return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return Response.json({ error: "Pagamentos ainda não foram configurados neste ambiente." }, { status: 503 });
    if (!user.email) return Response.json({ error: "Usuário sem e-mail." }, { status: 400 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const payment = await mpFetch("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": randomUUID() },
      body: JSON.stringify({
        transaction_amount: ANNUAL_PRICE,
        description: "tripsz Passaporte de Estádios — Anual (Pix)",
        payment_method_id: "pix",
        payer: { email: user.email },
        external_reference: user.id,
        metadata: { kind: "passport_pix", user_id: user.id },
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace("Z", "-00:00"),
        ...(siteUrl ? { notification_url: `${siteUrl}/api/webhook` } : {}),
      }),
    });

    const { error } = await supabaseAdmin().from("subscriptions").insert({
      user_id: user.id,
      plan: "annual",
      status: "pending",
      payment_method_id: "pix",
      mercadopago_payment_id: String(payment.id),
    });
    if (error) console.error("Erro ao salvar assinatura Pix:", error.message);

    return Response.json(pixInfo(payment));
  } catch (e) {
    console.error("Erro em /api/subscribe/pix:", e);
    return Response.json({ error: e.message || "Não foi possível gerar o Pix." }, { status: 500 });
  }
}

/** GET /api/subscribe/pix?paymentId=... — confere o Pix direto no Mercado Pago e libera o acesso. */
export async function GET(request) {
  try {
    const user = await authUser(request);
    if (!user) return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
    const paymentId = new URL(request.url).searchParams.get("paymentId");
    if (!paymentId) return Response.json({ error: "Pagamento não informado." }, { status: 400 });
    const payment = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`);
    if (!paymentUserOk(payment, user.id)) return Response.json({ error: "Pagamento não encontrado." }, { status: 404 });
    await activatePixPassport(payment);
    return Response.json({ status: payment.status });
  } catch (e) {
    return Response.json({ error: e.message || "Não foi possível consultar o pagamento." }, { status: 500 });
  }
}
