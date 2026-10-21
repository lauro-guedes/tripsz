"use client";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase";
import { buyPlan, loadStorePlans, restoreStorePurchases } from "../../lib/nativePurchases";
import { BORDER, FONT_BODY, FONT_DISPLAY, GREEN, GREEN_BG, MUTED, TEXT } from "../../lib/tokens";
import { useIsMobile } from "../ui/useIsMobile";

/** Checkout dentro do app: a compra é da App Store / Google Play (a cobrança e o cancelamento ficam na loja). */
export function StoreCheckout({ plan, onClose, onApproved }) {
  const isMobile = useIsMobile();
  const [userId, setUserId] = useState(null);
  const [plans, setPlans] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(plan === "monthly" ? "monthly" : "annual");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabaseBrowser().auth.getUser();
        if (!data.user) throw new Error("Entre na sua conta para assinar.");
        setUserId(data.user.id);
        setPlans(await loadStorePlans(data.user.id));
      } catch (e) {
        setError(e.message);
        setPlans({});
      }
    })();
  }, []);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try {
      if (await fn()) {
        setDone(true);
        setTimeout(() => onApproved?.(), 1500);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const choice = plans?.[selected];
  const opt = (key, label, hint) => {
    const p = plans?.[key];
    if (!p) return null;
    const on = selected === key;
    return (
      <div key={key} onClick={() => setSelected(key)} style={{ border: `1px solid ${on ? GREEN : BORDER}`, background: on ? GREEN_BG : "#fff", borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, margin: 0 }}>{label}</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, margin: 0 }}>{hint}</p>
        </div>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: GREEN, margin: 0, whiteSpace: "nowrap" }}>{p.price}</p>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 24, boxSizing: "border-box" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, maxHeight: isMobile ? "92dvh" : "calc(100dvh - 48px)", overflowY: "auto", borderRadius: isMobile ? "20px 20px 0 0" : 16, padding: 24, paddingBottom: "max(24px, env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 16, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Passaporte de Estádios</p>
          <div onClick={onClose} style={{ cursor: "pointer", padding: 4 }}><X size={20} color={MUTED} /></div>
        </div>
        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: GREEN_BG, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={28} color={GREEN} /></div>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Assinatura confirmada!</p>
          </div>
        ) : (
          <>
            {plans === null && <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: MUTED, margin: 0 }}>Carregando planos...</p>}
            {plans && opt("annual", "Anual", "Renova todo ano")}
            {plans && opt("monthly", "Mensal", "Renova todo mês")}
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
            <div onClick={busy || !choice ? undefined : () => run(() => buyPlan(userId, choice.pkg))} style={{ background: GREEN, borderRadius: 12, padding: "14px 0", textAlign: "center", cursor: busy || !choice ? "default" : "pointer", opacity: busy || !choice ? 0.6 : 1 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: "#fff", margin: 0 }}>{busy ? "Processando..." : "Assinar"}</p>
            </div>
            <p onClick={busy || !userId ? undefined : () => run(() => restoreStorePurchases(userId))} style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, color: MUTED, textAlign: "center", textDecoration: "underline", margin: 0, cursor: "pointer" }}>Restaurar compras</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 11, lineHeight: 1.5, color: MUTED, margin: 0 }}>
              O pagamento é cobrado na sua conta da loja (App Store ou Google Play) e a assinatura renova automaticamente, até ser cancelada nas configurações da loja ao menos 24 horas antes do fim do período. Ao assinar, você aceita os <a href="/termos" style={{ color: MUTED }}>Termos</a> e a <a href="/privacidade" style={{ color: MUTED }}>Política de Privacidade</a>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
