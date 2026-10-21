import { supabaseAdmin } from "@/lib/supabase";

/**
 * Assinaturas compradas dentro do app (App Store / Google Play), intermediadas pelo RevenueCat.
 * Entram na MESMA tabela `subscriptions` do Mercado Pago (payment_method_id = "apple" | "google"),
 * então o acesso ao Passaporte, o painel admin e as telas de conta seguem funcionando sem mudança.
 * Só SERVIDOR.
 */
const ENTITLEMENT = process.env.REVENUECAT_ENTITLEMENT || "premium";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUserId = (v) => typeof v === "string" && UUID.test(v);

function planFromProduct(productId = "") {
  return /anual|annual|year|12m/i.test(productId) ? "annual" : "monthly";
}

/** Consulta o RevenueCat (fonte da verdade) e espelha o resultado em `subscriptions`. */
export async function syncStoreSubscription(userId) {
  if (!isUserId(userId)) return { synced: false, reason: "usuário inválido" };
  const key = process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) return { synced: false, reason: "REVENUECAT_SECRET_API_KEY não configurada" };

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return { synced: false, reason: `RevenueCat ${res.status}` };
  const { subscriber } = await res.json();

  const ent = subscriber?.entitlements?.[ENTITLEMENT];
  const now = Date.now();
  const expiresMs = ent?.expires_date ? new Date(ent.expires_date).getTime() : null;
  const active = !!ent && (expiresMs === null || expiresMs > now);
  const sub = ent ? subscriber?.subscriptions?.[ent.product_identifier] : null;
  const store = String(sub?.store || "").toLowerCase();
  const method = store === "play_store" ? "google" : "apple";

  const supabase = supabaseAdmin();
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("payment_method_id", ["apple", "google"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ent && !existing) return { synced: true, active: false };

  const row = {
    plan: planFromProduct(ent?.product_identifier),
    status: active ? "active" : "cancelled",
    payment_method_id: method,
    current_period_end: expiresMs ? new Date(expiresMs).toISOString().slice(0, 10) : null,
    updated_at: new Date().toISOString(),
  };
  if (existing) await supabase.from("subscriptions").update(row).eq("id", existing.id);
  else if (ent) await supabase.from("subscriptions").insert({ user_id: userId, ...row });
  return { synced: true, active };
}
