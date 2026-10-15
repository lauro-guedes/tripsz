import { calendarConfigured, createConsultoriaEvent } from "./googleCalendar";
import { supabaseAdmin } from "@/lib/supabase";

// Chamada direta à API REST do Mercado Pago (servidor).
export async function mpFetch(path, options = {}) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || JSON.stringify(data));
  }
  return data;
}

export function addDaysISO(days, from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Pix do plano anual: acesso por 365 dias a partir da confirmação.
export const PIX_ANNUAL_DAYS = 365;

/**
 * Libera o Passaporte quando o Pix anual é aprovado. Idempotente: pode ser
 * chamada pelo webhook e pela consulta da tela ao mesmo tempo.
 * `payment` é o objeto de pagamento devolvido pelo Mercado Pago.
 */
export async function activatePixPassport(payment) {
  const supabase = supabaseAdmin();
  const paymentId = String(payment.id);
  const { data: sub } = await supabase.from("subscriptions").select("*").eq("mercadopago_payment_id", paymentId).maybeSingle();
  if (!sub) return null;
  if (payment.status === "approved" && sub.status !== "active") {
    const { data: updated } = await supabase
      .from("subscriptions")
      .update({ status: "active", current_period_end: addDaysISO(PIX_ANNUAL_DAYS), updated_at: new Date().toISOString() })
      .eq("id", sub.id)
      .eq("status", sub.status)
      .select()
      .maybeSingle();
    return updated || sub;
  }
  if ((payment.status === "cancelled" || payment.status === "rejected" || payment.status === "expired") && sub.status === "pending") {
    await supabase.from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", sub.id);
  }
  return sub;
}

// Marca o pedido de consultoria como pago/recusado conforme o pagamento.
export async function syncConsultoriaOrder(payment) {
  const supabase = supabaseAdmin();
  const paymentId = String(payment.id);
  if (payment.status === "approved") {
    await supabase
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("mercadopago_payment_id", paymentId)
      .neq("status", "paid");
    await addConsultoriaToCalendar(paymentId);
  } else if (["cancelled", "rejected", "expired"].includes(payment.status)) {
    await supabase.from("orders").update({ status: "cancelled" }).eq("mercadopago_payment_id", paymentId).eq("status", "pending");
  }
}

// Dados do Pix que a tela precisa mostrar.
export function pixInfo(payment) {
  const t = payment.point_of_interaction?.transaction_data || {};
  return {
    paymentId: String(payment.id),
    qrCode: t.qr_code || null,
    qrCodeBase64: t.qr_code_base64 || null,
    expiresAt: payment.date_of_expiration || null,
  };
}

export function paymentUserOk(payment, userId) {
  return payment?.metadata?.user_id === userId || payment?.external_reference === userId;
}

/** Cria o evento na Agenda do pedido pago. Nunca falha o pagamento: erro só vai pro log. */
export async function addConsultoriaToCalendar(paymentId) {
  try {
    if (!calendarConfigured()) return;
    const supabase = supabaseAdmin();
    const { data: order } = await supabase
      .from("orders")
      .select("user_id, scheduled_date, scheduled_time, status, item_type")
      .eq("mercadopago_payment_id", String(paymentId))
      .maybeSingle();
    if (!order || order.item_type !== "consultoria" || order.status !== "paid") return;
    const { data: u } = await supabase.auth.admin.getUserById(order.user_id);
    await createConsultoriaEvent({
      paymentId,
      date: order.scheduled_date,
      time: order.scheduled_time,
      clientEmail: u?.user?.email || null,
      clientName: u?.user?.user_metadata?.name || null,
    });
  } catch (e) {
    console.error("[googleCalendar] falhou ao criar o evento:", e.message);
  }
}
