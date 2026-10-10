"use client";
import { authFetch } from "../../lib/authFetch";
import { supabaseBrowser } from "../../lib/supabase";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, GOLD_BG, GOLD_BORDER, GREEN, GREEN_BUTTON2, MUTED, TEXT } from "../../lib/tokens";
import { AuthedNav } from "../nav/AuthedNav";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";
import { Loading } from "../ui/Loading";
import { useIsMobile } from "../ui/useIsMobile";
import { CreditCard, Info, Lock, QrCode, Receipt, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function Checkout({ answers, selectedOption, paymentNotice, onBack, onDone, onNavigate, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Quem está contratando já está logada: o topo é o da área logada (antes era o da página
  // inicial, e clicar no logo ou no menu levava pra Home e apagava o roteiro em andamento).
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser().auth.getUser();
      setUserName(data.user?.user_metadata?.name || data.user?.email || "");
      setUserAvatar(data.user?.user_metadata?.avatar_url || null);
    })();
  }, []);

  // Próximos dias em que a consultoria atende de verdade: segunda,
  // quarta, sexta e sábado — datas reais, não fixas no código, então
  // nunca aparece uma data que já passou.
  const CONSULTORIA_DAYS_OF_WEEK = [1, 3, 5, 6];
  const availableDays = useMemo(() => {
    const days = [];
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (days.length < 6) {
      if (CONSULTORIA_DAYS_OF_WEEK.includes(d.getDay())) {
        days.push({
          date: new Date(d),
          label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
          day: d.getDate(),
        });
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, []);

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedTime, setSelectedTime] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const selectedDay = availableDays[selectedDayIdx];
  const scheduledDateStr = selectedDay.date.toISOString().split("T")[0];

  useEffect(() => {
    (async () => {
      setLoadingSlots(true);
      setSelectedTime(null);
      try {
        const res = await fetch(`/api/consultoria/availability?date=${scheduledDateStr}`);
        const data = await res.json();
        setTimeSlots(data.slots || []);
        const firstAvailable = (data.slots || []).find((s) => s.available);
        if (firstAvailable) setSelectedTime(firstAvailable.time);
      } catch {
        setTimeSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [scheduledDateStr]);

  const handlePayConsultoria = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: answers.userId,
          tripAnswersId: answers.tripAnswersId,
          selectedOption,
          scheduledDate: scheduledDateStr,
          scheduledTime: selectedTime,
        }),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("O servidor não respondeu corretamente. Tente novamente em instantes.");
      }
      if (!res.ok) throw new Error(data.error || "Não foi possível iniciar o pagamento.");
      // Manda o usuário pro checkout de verdade do Mercado Pago
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const isMobile = useIsMobile();

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="roteiros" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
      <div style={{ padding: isMobile ? "24px 16px" : 80, display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48 }}>
        <div onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", width: "fit-content" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>← Voltar ao roteiro</p>
        </div>
        {paymentNotice && (
          <div style={{ background: paymentNotice === "failed" ? "#fef2f2" : GOLD_BG, border: `1px solid ${paymentNotice === "failed" ? "#fecaca" : GOLD_BORDER}`, borderRadius: 12, padding: 16 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: paymentNotice === "failed" ? "#b91c1c" : GOLD, margin: 0 }}>
              {paymentNotice === "failed" ? "O pagamento não foi concluído." : "Seu pagamento está em análise."}
            </p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.4, color: BODY, margin: "4px 0 0" }}>
              {paymentNotice === "failed" ? "Nada foi cobrado. Você pode tentar de novo abaixo." : "Assim que o Mercado Pago confirmar, a consultoria aparece em Meus Roteiros. Você não precisa pagar de novo."}
            </p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Badge>Consultoria Opcional</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 40, color: TEXT, margin: 0 }}>Contrate a consultoria humana</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, color: BODY, margin: 0 }}>Pague R$ 149,90 e receba ajuda humana para hotéis, reservas, ingressos e ajustes finais da viagem.</p>
        </div>

        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 40 }}>
          <div style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>O que a consultoria inclui</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 14 }}>
              {["Ajuda para escolher hotéis próximos aos estádios", "Sugestões de reservas e transferências", "Ajustes finais do roteiro com base nas suas preferências"].map((l) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, color: BODY, margin: 0 }}>{l}</p>
                  <p style={{ fontFamily: FONT_MONO, color: TEXT, margin: 0 }}>Incluso</p>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Valor único</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: GREEN, margin: 0 }}>R$ 149,90</p>
            </div>

            <div style={{ background: BG_ALT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Shield size={16} color={TEXT} />
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Consultoria humana</p>
                </div>
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: BODY, margin: 0 }}>Uma sessão com especialista para organizar hospedagem, reservas, ingressos e ajustes finais do roteiro.</p>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>Valor total da consultoria</p>
            </div>

            <div style={{ background: BG_ALT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? 14 : 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Agendamento da consultoria</p>
                <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: BODY, margin: "4px 0 0" }}>Escolha uma data disponível e o horário para a conversa com o especialista.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Data disponível</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {availableDays.map((d, i) => {
                    const active = i === selectedDayIdx;
                    return (
                      <div key={i} onClick={() => setSelectedDayIdx(i)} style={{ background: active ? GREEN_BUTTON2 : "#fff", border: `1px solid ${active ? GREEN_BUTTON2 : BORDER}`, borderRadius: 10, padding: isMobile ? 8 : 12, width: isMobile ? "calc(25% - 9px)" : 96, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: active ? "#fff" : MUTED, margin: 0, textTransform: "capitalize" }}>{d.label}</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: active ? "#fff" : TEXT, margin: 0 }}>{d.day}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Horários disponíveis</p>
                {loadingSlots ? (
                  <Loading text="Carregando horários..." compact />
                ) : timeSlots.length === 0 ? (
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, margin: 0 }}>Sem atendimento nesse dia — escolha outra data.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {timeSlots.map((s) => {
                      const active = s.time === selectedTime;
                      return (
                        <div
                          key={s.time}
                          onClick={() => s.available && setSelectedTime(s.time)}
                          style={{ background: active ? GREEN_BUTTON2 : "#fff", border: `1px solid ${active ? GREEN_BUTTON2 : BORDER}`, borderRadius: 8, padding: "10px 14px", cursor: s.available ? "pointer" : "default", opacity: s.available ? 1 : 0.4 }}
                        >
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: active ? "#fff" : TEXT, margin: 0, textDecoration: s.available ? "none" : "line-through" }}>{s.time}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedTime && (
                <div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{selectedDay.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} · {selectedTime}</p>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: BODY, margin: "4px 0 0" }}>Sessão de 30 minutos via vídeo. Você receberá o link de acesso após a confirmação do pagamento.</p>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: BORDER }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Total Final</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: GREEN, margin: 0 }}>R$ 149,90</p>
            </div>
            <div style={{ background: BG_ALT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Info size={16} color={MUTED} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.5, color: BODY, margin: 0 }}>Este pagamento contrata a consultoria humana. Após a confirmação, você receberá um link para acessar a agenda e confirmar a data e o horário da sessão.</p>
            </div>
          </div>

          <div style={{ width: isMobile ? "100%" : 480, flexShrink: 0, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Resumo do Pedido</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Consultoria humana - tripsz</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>R$ 149,90</p>
              </div>
              <div style={{ height: 1, background: BORDER, width: "100%" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Formas de pagamento</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ background: BG, border: `1px solid ${BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: 999 }}>
                    <CreditCard size={14} color={TEXT} />
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Cartão de crédito</p>
                  </div>
                  <div style={{ background: BG, border: `1px solid ${BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: 999 }}>
                    <QrCode size={14} color={TEXT} />
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Pix</p>
                  </div>
                  <div style={{ background: BG, border: `1px solid ${BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: 999 }}>
                    <Receipt size={14} color={TEXT} />
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Boleto</p>
                  </div>
                </div>
              </div>
              <div style={{ background: BG_ALT, display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 12, width: "100%" }}>
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="arrowRight" size={16} color={TEXT} />
                </div>
                <p style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.5, color: BODY, margin: 0 }}>Você será redirecionado ao ambiente seguro do Mercado Pago para concluir o pagamento com Pix, cartão ou boleto.</p>
              </div>
            </div>
            <div style={{ background: BG_ALT, borderRadius: 12, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <Lock size={16} color={MUTED} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>Pagamento processado com segurança pelo Mercado Pago</p>
            </div>
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
            <div onClick={loading || !selectedTime ? undefined : handlePayConsultoria} style={{ background: GREEN, opacity: loading || !selectedTime ? 0.5 : 1, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "16px 24px", borderRadius: 8, cursor: loading || !selectedTime ? "default" : "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: "#fff", textTransform: "uppercase", margin: 0 }}>{loading ? "Redirecionando..." : "Confirmar e ir para o Mercado Pago"}</p>
              {!loading && <Icon name="arrowRight" size={16} color="#fff" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
