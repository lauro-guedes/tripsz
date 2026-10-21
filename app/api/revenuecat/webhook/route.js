import { isUserId, syncStoreSubscription } from "@/lib/storeSubs";

/**
 * POST /api/revenuecat/webhook — o RevenueCat avisa compra, renovação, cancelamento e expiração.
 * Configure no RevenueCat: URL https://www.tripsz.com.br/api/revenuecat/webhook e o cabeçalho
 * Authorization com o mesmo valor de REVENUECAT_WEBHOOK_AUTH. Não confiamos no corpo: só pegamos o
 * usuário e reconsultamos o estado atual na API do RevenueCat.
 */
export async function POST(request) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected || request.headers.get("authorization") !== expected) return Response.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const { event } = await request.json();
    const ids = [event?.app_user_id, event?.original_app_user_id, ...(event?.aliases || [])].filter(isUserId);
    for (const id of [...new Set(ids)]) await syncStoreSubscription(id);
  } catch (e) {
    console.error("Erro em /api/revenuecat/webhook:", e);
  }
  return Response.json({ received: true });
}
