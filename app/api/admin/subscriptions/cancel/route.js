import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

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
 * POST /api/admin/subscriptions/cancel
 * body: { email: "admin@tripsz.com", subscriptionId: "UUID" }
 *
 * Cancela essa assinatura específica no Mercado Pago e marca como
 * "cancelled" no nosso banco. Os dados do Passport da pessoa continuam
 * intactos — só o acesso pago é pausado.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, subscriptionId } = body;

    if (!(await requireAdmin(request))) {
      return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
    }
    if (!subscriptionId) {
      return Response.json({ error: "subscriptionId é obrigatório." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (subError || !sub) {
      return Response.json({ error: "Assinatura não encontrada." }, { status: 404 });
    }
    if (!["active", "pending"].includes(sub.status)) {
      return Response.json({ error: `Essa assinatura já está "${sub.status}" — não há o que cancelar.` }, { status: 400 });
    }

    if (sub.mercadopago_preapproval_id) {
      await mpFetch(`/preapproval/${sub.mercadopago_preapproval_id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      });
    }

    await supabase.from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", sub.id);

    return Response.json({ success: true });
  } catch (e) {
    console.error("Erro em /api/admin/subscriptions/cancel:", e);
    return Response.json({ error: e.message || "Não foi possível cancelar a assinatura." }, { status: 500 });
  }
}
