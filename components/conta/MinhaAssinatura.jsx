"use client";
import { authFetch } from "../../lib/authFetch";
import { checkPassportAccess } from "../../lib/passportAccess";
import { supabaseBrowser } from "../../lib/supabase";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, GREEN, GREEN_BG, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import { PHOTO_STADIUM } from "../landing/LandingPage";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { Badge } from "../ui/Badge";
import { Loading } from "../ui/Loading";
import { useIsMobile } from "../ui/useIsMobile";
import { PassportPaywall } from "./PassportPaywall";
import { CardNumber, ExpirationDate, SecurityCode, createCardToken, initMercadoPago } from "@mercadopago/sdk-react";
import { AlertCircle, Check, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";

/* --- Minha Assinatura: gerenciar plano, ver status, cancelar --- */
// Nomes amigáveis pros IDs de bandeira que o Mercado Pago devolve.
export const PAYMENT_METHOD_NAMES = {
  visa: "Cartão Visa",
  master: "Cartão Mastercard",
  amex: "Cartão American Express",
  elo: "Cartão Elo",
  hipercard: "Cartão Hipercard",
  diners: "Cartão Diners Club",
  account_money: "Saldo em conta Mercado Pago",
  pix: "Pix",
};

// Só inicializa o SDK do Mercado Pago uma vez, mesmo se o modal abrir e
// fechar várias vezes.
export let mpInitialized = false;

/* --- Atualizar Cartão: usa os "Secure Fields" do Mercado Pago — os
   campos de número/validade/CVV rodam isolados no SDK deles, o dado
   bruto do cartão nunca passa pelo nosso código nem pelo nosso servidor,

   só o token gerado. --- */
export function AtualizarCartaoModal({ userId, onClose, onSaved }) {
  const [cardholderName, setCardholderName] = useState("");
  const [cpf, setCpf] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mpInitialized && process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) {
      initMercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);
      mpInitialized = true;
    }
  }, []);

  const handleSave = async () => {
    if (!cardholderName.trim()) return setError("Preencha o nome como está no cartão.");
    if (!cpf.trim()) return setError("Preencha o CPF do titular do cartão.");
    setSaving(true);
    setError(null);
    try {
      const token = await createCardToken({
        cardholderName: cardholderName.trim(),
        identificationType: "CPF",
        identificationNumber: cpf.replace(/\D/g, ""),
      });
      const res = await authFetch("/api/subscribe/update-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, cardTokenId: token.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível atualizar o cartão.");
      onSaved();
    } catch (e) {
      setError(e.message || "Não foi possível gerar o token do cartão. Confira os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const fieldBoxStyle = { background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" };
  const labelStyle = { fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: "0 0 6px" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 342, display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ background: "rgba(0,200,83,0.07)", borderRadius: 999, padding: 12 }}>
            <CreditCard size={28} color={GREEN} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center", textAlign: "center" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Atualizar pagamento</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Insira os dados do novo cartão de crédito para faturamento.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <p style={labelStyle}>Número do cartão</p>
            <div style={fieldBoxStyle}>
              <CardNumber placeholder="0000 0000 0000 0000" style={{ base: { fontSize: "14px", fontFamily: "Inter, sans-serif", color: TEXT } }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Validade</p>
              <div style={fieldBoxStyle}>
                <ExpirationDate placeholder="MM/AA" style={{ base: { fontSize: "14px", fontFamily: "Inter, sans-serif", color: TEXT } }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>CVV</p>
              <div style={fieldBoxStyle}>
                <SecurityCode placeholder="123" style={{ base: { fontSize: "14px", fontFamily: "Inter, sans-serif", color: TEXT } }} />
              </div>
            </div>
          </div>
          <div>
            <p style={labelStyle}>Nome no cartão</p>
            <input value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} placeholder="Nome como está no cartão" style={{ ...fieldBoxStyle, width: "100%", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, outline: "none" }} />
          </div>
          <div>
            <p style={labelStyle}>CPF do titular</p>
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" style={{ ...fieldBoxStyle, width: "100%", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, outline: "none" }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, color: MUTED, margin: "4px 0 0" }}>Exigido pelo Mercado Pago pra gerar o token do cartão com segurança — não fica salvo com a gente.</p>
          </div>
        </div>
        {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 12 }}>
          <div onClick={onClose} style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "12px 20px", textAlign: "center", cursor: "pointer" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Cancelar</p>
          </div>
          <div onClick={saving ? undefined : handleSave} style={{ flex: 1, background: GREEN, opacity: saving ? 0.6 : 1, borderRadius: 999, padding: "12px 20px", textAlign: "center", cursor: saving ? "default" : "pointer" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{saving ? "Salvando..." : "Salvar"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MinhaAssinatura({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [access, setAccess] = useState(null);
  const [canceling, setCanceling] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  const load = async () => {
    const acc = await checkPassportAccess();
    setAccess(acc);
    const supabase = supabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    setUserName(userData.user?.user_metadata?.name || userData.user?.email || "");
    setUserAvatar(userData.user?.user_metadata?.avatar_url || null);

    if (acc.userId) {
      try {
        const res = await authFetch(`/api/subscribe/invoices?userId=${acc.userId}`);
        const data = await res.json();
        setInvoices(res.ok ? data.invoices : []);
      } catch {
        setInvoices([]);
      }
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCancel = async () => {
    setCanceling(true);
    setError(null);
    try {
      const res = await authFetch("/api/subscribe/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: access.userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível cancelar.");
      setShowCancelModal(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCanceling(false);
    }
  };

  // Trocar de plano hoje funciona cancelando o antigo e criando um novo —
  // o Mercado Pago não tem uma troca direta de valor/frequência numa
  // assinatura já ativa, então esse é o jeito real de fazer isso.
  const handleSwitchPlan = async (newPlan) => {
    if (!window.confirm(`Trocar para o plano ${newPlan === "annual" ? "anual" : "mensal"}? Sua assinatura atual será cancelada e você será redirecionado para confirmar a nova.`)) return;
    setSwitching(true);
    setError(null);
    try {
      const cancelRes = await authFetch("/api/subscribe/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: access.userId }),
      });
      if (!cancelRes.ok) {
        const d = await cancelRes.json();
        throw new Error(d.error || "Não foi possível cancelar o plano atual.");
      }
      const res = await authFetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: access.userId, email: access.userEmail, plan: newPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível iniciar o novo plano.");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e.message);
      setSwitching(false);
    }
  };

  if (access === null) {
    return (
      <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
        <AuthedNav active="perfil" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <Loading />
      </div>
    );
  }

  const sub = access.subscription;
  const planLabel = sub?.plan === "annual" ? "Plano Assinante — Anual" : sub?.plan === "monthly" ? "Plano Assinante — Mensal" : null;
  const planPrice = sub?.plan === "annual" ? "R$ 99,90/ano" : "R$ 9,90/mês";
  // Próxima cobrança estimada a partir da data de início — o Mercado Pago
  // não devolve essa data pronta pra gente exibir, então calculamos com
  // base na frequência do plano (mensal = +1 mês, anual = +1 ano).
  const nextBilling = sub?.created_at
    ? (() => {
        const d = new Date(sub.created_at);
        if (sub.plan === "annual") d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      })()
    : null;

  const perks = ["Football Passport completo", "Gamificação e conquistas", "Categorias de torcedor (5 níveis)", "Histórico completo de jogos", "15% desconto em consultorias", "Alertas personalizados de jogos"];

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="perfil" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16, padding: isMobile ? `32px ${px}` : `48px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <Badge>Configurações de Conta</Badge>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 40, color: TEXT, margin: 0 }}>Minha Assinatura</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 14, color: MUTED, margin: 0 }}>Gerencie seu plano, método de pagamento e histórico de faturas.</p>
      </div>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, padding: isMobile ? `24px ${px} 48px` : `40px ${px} 80px` }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, maxWidth: isMobile ? "100%" : 780 }}>
          {access.legacy ? (
            <div style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: GREEN, margin: 0 }}>Acesso liberado (conta antiga)</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: BODY, margin: 0 }}>Sua conta foi criada antes do lançamento da assinatura do Passport, então você continua com acesso livre, sem precisar pagar nada.</p>
            </div>
          ) : sub?.status === "active" ? (
            <>
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0px 4px 6px rgba(15,23,42,0.05)", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, color: TEXT, margin: 0 }}>Plano Atual</p>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: GREEN }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 28, color: TEXT, margin: 0 }}>{planLabel}</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, color: GREEN, margin: 0 }}>{planPrice}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {nextBilling && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Próxima cobrança: {nextBilling}</p>}
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Renovação automática ativada</p>
                </div>
                {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div onClick={switching || canceling ? undefined : () => handleSwitchPlan(sub.plan === "annual" ? "monthly" : "annual")} style={{ border: `1px solid ${BORDER}`, borderRadius: 999, padding: "10px 20px", cursor: switching ? "default" : "pointer", opacity: switching ? 0.6 : 1 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{switching ? "Processando..." : `Trocar para ${sub.plan === "annual" ? "mensal" : "anual"}`}</p>
                  </div>
                  <p onClick={() => setShowCancelModal(true)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#ef4444", margin: 0, cursor: "pointer" }}>Cancelar assinatura</p>
                </div>
              </div>

              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0px 4px 6px rgba(15,23,42,0.05)", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, color: TEXT, margin: 0 }}>Método de Pagamento</p>
                {sub?.payment_method_id ? (
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <CreditCard size={32} color={GREEN} />
                    <div>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{PAYMENT_METHOD_NAMES[sub.payment_method_id] || sub.payment_method_id}</p>
                      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Os últimos dígitos do cartão não ficam disponíveis nessa integração — só a bandeira.</p>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, margin: 0 }}>Ainda não identificamos a forma de pagamento — isso aparece assim que o Mercado Pago confirmar a assinatura.</p>
                )}
                {sub?.status === "active" && (
                  <div onClick={() => setShowCardModal(true)} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 16px", textAlign: "center", cursor: "pointer", width: isMobile ? "100%" : 200 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Atualizar cartão</p>
                  </div>
                )}
              </div>

              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0px 4px 6px rgba(15,23,42,0.05)", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, color: TEXT, margin: 0 }}>Histórico de Faturas</p>
                {invoices === null && <Loading compact />}
                {invoices !== null && invoices.length === 0 && (
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, margin: 0 }}>Nenhuma fatura ainda — a primeira cobrança aparece aqui assim que for processada.</p>
                )}
                {invoices !== null && invoices.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {!isMobile && (
                      <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, paddingBottom: 12 }}>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0, width: 120 }}>Data</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0, flex: 1 }}>Descrição</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0, width: 100 }}>Valor</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0, width: 90, textAlign: "right" }}>Status</p>
                      </div>
                    )}
                    {invoices.map((inv, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, alignItems: isMobile ? "flex-start" : "center", padding: "16px 0", borderBottom: `1px solid ${BORDER}` }}>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, margin: 0, width: isMobile ? "auto" : 120 }}>{new Date(inv.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT, margin: 0, flex: isMobile ? "none" : 1 }}>{inv.plan}</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, margin: 0, width: isMobile ? "auto" : 100 }}>{Number(inv.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                        <div style={{ width: isMobile ? "auto" : 90, display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                          <div style={{ width: 10, height: 10, borderRadius: 5, background: inv.status === "processed" || inv.status === "approved" ? GREEN : inv.status === "scheduled" || inv.status === "pending" ? GOLD : "#ef4444" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <PassportPaywall userId={access.userId} userEmail={access.userEmail} userName={userName} userAvatar={userAvatar} />
          )}
        </div>

        {(access.legacy || sub?.status === "active") && (
          <div style={{ width: isMobile ? "100%" : 420, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0px 4px 6px rgba(15,23,42,0.05)", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT, margin: 0 }}>O que está incluído</p>
              {perks.map((p) => (
                <div key={p} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ background: GREEN_BG, width: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check size={12} color={GREEN} />
                  </div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, margin: 0 }}>{p}</p>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0px 4px 6px rgba(15,23,42,0.05)", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT, margin: 0 }}>Precisa de ajuda?</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: MUTED, margin: 0 }}>Dúvidas sobre sua assinatura ou problemas com o pagamento?</p>
              <a href="mailto:suporte@tripsz.com.br" style={{ background: GREEN_BUTTON, borderRadius: 999, padding: "12px 20px", textAlign: "center", textDecoration: "none" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", margin: 0 }}>Falar com suporte</p>
              </a>
              <div onClick={() => onNavigate("landing")} style={{ border: `1px solid ${BORDER}`, borderRadius: 999, padding: "12px 20px", textAlign: "center", cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Perguntas frequentes</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <AuthedFooter />

      {showCancelModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 342, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ background: "rgba(239,68,68,0.06)", borderRadius: 999, padding: 12 }}>
                <AlertCircle size={28} color="#ef4444" />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Cancelar assinatura</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, lineHeight: 1.4, color: MUTED, margin: 0 }}>Tem certeza? Você perderá acesso a todos os seus benefícios premium:</p>
            </div>
            <div style={{ background: BG, borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {["Football Passport completo", "Conquistas e sistema de gamificação", "Categorias de torcedor", "Registro ilimitado de jogos", "15% de desconto em consultorias", "Histórico completo de partidas"].map((label) => (
                <div key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid #ef4444", borderRadius: 8, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 9, color: "#ef4444", margin: 0 }}>✕</p>
                  </div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 12, color: TEXT, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ background: "rgba(234,179,8,0.13)", borderRadius: 8, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 10, color: "#b48200", margin: 0 }}>i</p>
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 11, lineHeight: 1.3, color: TEXT, margin: 0 }}>Seu plano permanecerá ativo até o final do período vigente.</p>
            </div>
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "100%" }}>
              <div onClick={() => setShowCancelModal(false)} style={{ background: GREEN, borderRadius: 999, padding: "12px 24px", textAlign: "center", cursor: "pointer", width: "100%" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>Manter assinatura</p>
              </div>
              <p onClick={canceling ? undefined : handleCancel} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#ef4444", margin: 0, cursor: canceling ? "default" : "pointer", padding: "8px 0" }}>{canceling ? "Cancelando..." : "Confirmar cancelamento"}</p>
            </div>
          </div>
        </div>
      )}

      {showCardModal && (
        <AtualizarCartaoModal
          userId={access.userId}
          onClose={() => setShowCardModal(false)}
          onSaved={() => {
            setShowCardModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
