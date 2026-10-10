"use client";
import { authFetch } from "../../lib/authFetch";
import { FAN_LEVEL_TEXTS } from "../../lib/fanLevels";
import { initials } from "../../lib/textUtils";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, GREEN, GREEN_BG, GREEN_BUTTON, GREEN_BUTTON2, MUTED, TEXT } from "../../lib/tokens";
import { PHOTO_STADIUM } from "../landing/LandingPage";
import { Badge } from "../ui/Badge";
import { useIsMobile } from "../ui/useIsMobile";
import { Award, BarChart2, Clipboard, Share2, Star, TrendingUp } from "lucide-react";
import { useState } from "react";

export function PassportPaywall({ userId, userEmail, userName, userAvatar, onCreateNew }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);

  const handleSubscribe = async (plan) => {
    setError(null);
    setLoadingPlan(plan);
    try {
      const res = await authFetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: userEmail, plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível iniciar a assinatura.");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e.message);
      setLoadingPlan(null);
    }
  };

  const features = [
    [Clipboard, "Registro Ilimitado de Jogos", "Adicione todas as partidas que você já assistiu ou planeja assistir nos estádios europeus."],
    [Award, "Conquistas Exclusivas", "Desbloqueie conquistas personalizadas para cada clássico, liga ou país que você visitar."],
    [BarChart2, "Estatísticas Completas", "Acompanhe gráficos ricos sobre sua jornada, estádios visitados e gols assistidos ao vivo."],
    [TrendingUp, "Ranking de Torcedores", "Compare seu passaporte com outros viajantes e dispute a liderança no ranking nacional."],
    [Star, FAN_LEVEL_TEXTS.featureTitle, FAN_LEVEL_TEXTS.featureBody],
    [Share2, "Compartilhamento Social", "Gere cards personalizados perfeitos para postar no Instagram e mostrar seu progresso."],
  ];

  return (
    <div style={{ background: BG, width: "100%" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 64, alignItems: "center", flexWrap: "wrap", padding: isMobile ? `32px ${px}` : `64px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <div style={{ position: "relative", flex: isMobile ? 1 : "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <Badge>Documento Oficial do Torcedor</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 56, lineHeight: 1.05, color: TEXT, margin: 0 }}>Seu Football Passport</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 22, lineHeight: 1.5, color: BODY, margin: 0 }}>Toda atmosfera vivida, cada arquibancada tremendo e os templos do futebol mundial que você já conquistou. Colecione conquistas de suas viagens.</p>
        </div>
        <div style={{ position: "relative", background: "#fff", border: `2px solid ${GREEN}`, boxShadow: "0px 12px 24px rgba(0,200,83,0.08)", borderRadius: 16, padding: isMobile ? 20 : 32, width: isMobile ? "100%" : 420, maxWidth: "100%", flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>FOOTBALL PASSPORT</p>
            <Award size={22} color={GREEN} />
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ width: 80, height: 100, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden", flexShrink: 0, background: GREEN_BUTTON2, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {userAvatar ? <img src={userAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: "#fff", margin: 0 }}>{initials(userName)}</p>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nome do Titular</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{userName || "—"}</p>
              </div>
              <div>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nível de Acesso</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>BLOQUEADO</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>ID: #PENDENTE</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>ATIVAÇÃO: —</p>
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? `24px ${px} 48px` : `24px ${px} 80px`, display: "flex", flexDirection: "column", gap: 24 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 22 : 32, color: TEXT, margin: 0 }}>O que você desbloqueia com o Passport:</p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
          {features.map(([Ic, title, body]) => (
            <div key={title} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ background: GREEN_BG, width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ic size={18} color={GREEN} />
              </div>
              <div>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{title}</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, lineHeight: 1.4, color: MUTED, margin: "4px 0 0" }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: `0 ${px} 24px` }}>
        <div style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 20 : 26, color: TEXT, margin: 0 }}>Escolha seu plano e desbloqueie agora</p>
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
          </div>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, width: "100%", maxWidth: 720, margin: "0 auto" }}>
            <div style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0 }}>Plano Mensal</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, color: TEXT, margin: 0 }}>R$ 9,90<span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>/mês</span></p>
              <div onClick={loadingPlan ? undefined : () => handleSubscribe("monthly")} style={{ background: BG_ALT, border: `1px solid ${BORDER}`, padding: "12px 20px", borderRadius: 8, textAlign: "center", cursor: loadingPlan ? "default" : "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{loadingPlan === "monthly" ? "Redirecionando..." : "Assinar Mensal"}</p>
              </div>
            </div>
            <div style={{ flex: 1, background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
              <div style={{ position: "absolute", top: -12, right: 20, background: GREEN, padding: "4px 12px", borderRadius: 999 }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: "#fff", margin: 0 }}>ECONOMIZE 16%</p>
              </div>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: GREEN, textTransform: "uppercase", margin: 0 }}>Plano Anual</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, color: TEXT, margin: 0 }}>R$ 99,90<span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>/ano</span></p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>Economia de R$ 18,90/ano</p>
              <div onClick={loadingPlan ? undefined : () => handleSubscribe("annual")} style={{ background: GREEN_BUTTON, padding: "12px 20px", borderRadius: 8, textAlign: "center", cursor: loadingPlan ? "default" : "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{loadingPlan === "annual" ? "Redirecionando..." : "Assinar Anual"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: `0 ${px} 80px` }}>
        <div style={{ background: "#0f172a", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: "#fff", margin: 0 }}>Pronto para planejar sua próxima arquibancada?</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#e2e8f0", margin: 0 }}>Gere um roteiro inteligente personalizado com os melhores clássicos, derbies e sequências possíveis de jogos.</p>
          {onCreateNew && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div onClick={onCreateNew} style={{ background: GREEN_BUTTON, padding: "14px 24px", borderRadius: 999, textAlign: "center", cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", margin: 0 }}>Montar meu roteiro →</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Meu Nível: sistema de XP calculado de verdade a partir dos dados do usuário --- */
// As categorias de torcedor (nomes, faixas de XP e textos) moraram aqui; agora ficam em lib/fanLevels.js.
