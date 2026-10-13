import { authUser } from "@/lib/serverAuth";
import { mpFetch, paymentUserOk, syncConsultoriaOrder } from "@/lib/mpServer";

/** GET /api/checkout/status?paymentId=... — consulta o Pix da consultoria e atualiza o pedido. */
export async function GET(request) {
  try {
    const user = await authUser(request);
    if (!user) return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
    const paymentId = new URL(request.url).searchParams.get("paymentId");
    if (!paymentId) return Response.json({ error: "Pagamento não informado." }, { status: 400 });
    const payment = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`);
    if (!paymentUserOk(payment, user.id)) return Response.json({ error: "Pagamento não encontrado." }, { status: 404 });
    await syncConsultoriaOrder(payment);
    return Response.json({ status: payment.status });
  } catch (e) {
    return Response.json({ error: e.message || "Não foi possível consultar o pagamento." }, { status: 500 });
  }
}
