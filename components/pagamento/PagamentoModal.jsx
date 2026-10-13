"use client";
import { BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BG, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { Check, Copy, CreditCard, QrCode, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

let mpReady = false;
function ensureMp() {
  if (!mpReady && process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) {
    initMercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY, { locale: "pt-BR" });
    mpReady = true;
  }
}

const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Checkout transparente do Mercado Pago, dentro de um modal (a pessoa não sai do site).
 *  - amount: valor em reais
 *  - title / subtitle: textos do topo
 *  - allowPix: mostra a aba Pix além do cartão
 *  - onCard(formData) -> { status }   envia o cartão ao servidor (lance erro se falhar)
 *  - onPix() -> { paymentId, qrCode, qrCodeBase64, expiresAt }
 *  - checkPix(paymentId) -> status do pagamento ("approved", "pending"...)
 *  - onApproved() chamado quando o pagamento é confirmado
 */
export function PagamentoModal({ amount, title, subtitle, allowPix, onCard, onPix, checkPix, onApproved, onClose, doneText }) {
  const [tab, setTab] = useState("card");
  const [pix, setPix] = useState(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const missingKey = !process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

  useEffect(() => {
    ensureMp();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      clearInterval(timer.current);
    };
  }, []);

  const finish = () => {
    clearInterval(timer.current);
    setDone(true);
    setTimeout(() => onApproved?.(), 1800);
  };

  const startPix = async () => {
    setError(null);
    setPixLoading(true);
    try {
      const info = await onPix();
      if (!info?.qrCode) throw new Error("Não foi possível gerar o Pix. Tente novamente.");
      setPix(info);
      clearInterval(timer.current);
      timer.current = setInterval(async () => {
        try {
          const st = await checkPix(info.paymentId);
          if (st === "approved") finish();
          else if (["cancelled", "rejected", "expired"].includes(st)) {
            clearInterval(timer.current);
            setPix(null);
            setError("O Pix expirou ou foi cancelado. Gere um novo.");
          }
        } catch {
          /* tenta de novo no próximo ciclo */
        }
      }, 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setPixLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão de área de transferência */
    }
  };

  const handleCard = async (formData) => {
    setError(null);
    setNotice(null);
    try {
      const res = await onCard(formData);
      if (res.status === "approved" || res.status === "active") finish();
      else setNotice("Seu pagamento está em análise. Assim que for confirmado, o acesso é liberado automaticamente.");
    } catch (e) {
      setError(e.message || "Não foi possível processar o cartão.");
      throw e; // avisa o formulário para liberar o botão
    }
  };

  const tabStyle = (active) => ({ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${active ? GREEN : BORDER}`, background: active ? GREEN_BG : "#fff" });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>{title}</p>
            {subtitle && <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, margin: "4px 0 0" }}>{subtitle}</p>}
          </div>
          <div onClick={onClose} style={{ cursor: "pointer", padding: 4 }}><X size={20} color={MUTED} /></div>
        </div>

        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: GREEN_BG, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={28} color={GREEN} /></div>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Pagamento confirmado!</p>
            {doneText && <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: MUTED, margin: 0, textAlign: "center" }}>{doneText}</p>}
          </div>
        ) : missingKey ? (
          <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#dc2626", margin: 0 }}>Pagamento indisponível: falta configurar NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY.</p>
        ) : (
          <>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: GREEN, margin: 0 }}>{brl(amount)}</p>
            {allowPix && (
              <div style={{ display: "flex", gap: 8 }}>
                <div onClick={() => setTab("card")} style={tabStyle(tab === "card")}><CreditCard size={16} color={TEXT} /><p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Cartão</p></div>
                <div onClick={() => setTab("pix")} style={tabStyle(tab === "pix")}><QrCode size={16} color={TEXT} /><p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Pix</p></div>
              </div>
            )}
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
            {notice && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: TEXT, background: GREEN_BG, borderRadius: 8, padding: 12, margin: 0 }}>{notice}</p>}

            {tab === "card" && (
              <CardPayment
                initialization={{ amount }}
                customization={{ paymentMethods: { maxInstallments: 1 }, visual: { hideFormTitle: true } }}
                onSubmit={handleCard}
                onError={(e) => console.error("Brick de cartão:", e)}
              />
            )}

            {tab === "pix" && allowPix && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "stretch" }}>
                {!pix ? (
                  <>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: MUTED, margin: 0 }}>Gere o QR Code, pague no app do seu banco e o acesso é liberado na hora. O Pix vale por 30 minutos.</p>
                    <div onClick={pixLoading ? undefined : startPix} style={{ background: GREEN_BUTTON, borderRadius: 8, padding: "14px 20px", textAlign: "center", cursor: pixLoading ? "default" : "pointer", opacity: pixLoading ? 0.6 : 1 }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{pixLoading ? "Gerando..." : "Gerar Pix"}</p>
                    </div>
                  </>
                ) : (
                  <>
                    {pix.qrCodeBase64 && <img alt="QR Code Pix" src={`data:image/png;base64,${pix.qrCodeBase64}`} style={{ width: 220, height: 220, alignSelf: "center" }} />}
                    <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0, wordBreak: "break-all", maxHeight: 64, overflow: "hidden" }}>{pix.qrCode}</p>
                    <div onClick={copy} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 20px", display: "flex", gap: 8, justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
                      {copied ? <Check size={16} color={GREEN} /> : <Copy size={16} color={TEXT} />}
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{copied ? "Copiado!" : "Copiar código Pix"}</p>
                    </div>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, margin: 0, textAlign: "center" }}>Aguardando o pagamento... esta tela confirma sozinha.</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
