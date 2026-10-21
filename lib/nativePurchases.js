"use client";
import { authFetch } from "./authFetch";
import { isNativeApp, nativePlugin } from "./nativeApp";

/**
 * Compra de assinatura dentro do app (Apple / Google) via RevenueCat. Só funciona no app nativo;
 * usa o plugin `Purchases` (@revenuecat/purchases-capacitor) que o Capacitor injeta na WebView.
 * Chaves públicas do SDK: NEXT_PUBLIC_REVENUECAT_IOS_KEY / NEXT_PUBLIC_REVENUECAT_ANDROID_KEY.
 */
let configuredFor = null;

function plugin() {
  const p = nativePlugin("Purchases");
  if (!p) throw new Error("Compras no app indisponíveis. Atualize o aplicativo.");
  return p;
}

async function ensureReady(userId) {
  const P = plugin();
  if (configuredFor === null) {
    const platform = window.Capacitor?.getPlatform?.();
    const apiKey = platform === "ios" ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY : process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;
    if (!apiKey) throw new Error("Compras no app ainda não foram configuradas.");
    await P.configure({ apiKey });
    configuredFor = "";
  }
  if (configuredFor !== userId) {
    await P.logIn({ appUserID: userId }); // mesmo id do Supabase: o servidor casa a compra com a conta
    configuredFor = userId;
  }
  return P;
}

export const canBuyInApp = () => isNativeApp();

/** Planos com o preço já formatado pela loja: { monthly: {pkg, price}, annual: {...} } */
export async function loadStorePlans(userId) {
  const P = await ensureReady(userId);
  const { current } = await P.getOfferings();
  const out = {};
  for (const pkg of current?.availablePackages || []) {
    const kind = pkg.packageType === "ANNUAL" ? "annual" : pkg.packageType === "MONTHLY" ? "monthly" : null;
    if (kind) out[kind] = { pkg, price: pkg.product?.priceString || "" };
  }
  return out;
}

async function confirmOnServer() {
  const res = await authFetch("/api/subscribe/store-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const data = await res.json().catch(() => ({}));
  return !!data.active;
}

/** Abre a folha de compra da loja. Devolve true se o acesso foi liberado; false se a pessoa cancelou. */
export async function buyPlan(userId, pkg) {
  const P = await ensureReady(userId);
  try {
    await P.purchasePackage({ aPackage: pkg });
  } catch (e) {
    if (e?.userCancelled || /cancel/i.test(e?.message || "")) return false;
    throw new Error(e?.message || "Não foi possível concluir a compra.");
  }
  for (let i = 0; i < 5; i++) {
    if (await confirmOnServer()) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Compra feita, mas a confirmação está demorando. Toque em “Restaurar compras” em instantes.");
}

export async function restoreStorePurchases(userId) {
  const P = await ensureReady(userId);
  await P.restorePurchases();
  return confirmOnServer();
}
