"use client";
import { useRef, useState } from "react";
import { BORDER, FONT_BODY, FONT_DISPLAY, GREEN, GREEN_BUTTON2, MUTED, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";
import { Wordmark } from "../ui/Wordmark";

/**
 * Tela inicial do APP (substitui a landing page só dentro do aplicativo): 3 telas de apresentação
 * e, no fim, a escolha entre entrar e criar conta. Quem já viu a apresentação cai direto na escolha.
 */
const SEEN_KEY = "tripsz_onboarding_seen";

const SLIDES = [
  { icon: "planeTakeoff", photo: "/foto-estadio.jpg", title: "Monte seu roteiro de futebol", body: "Escolha países, datas e times. A gente cruza os jogos e entrega a melhor sequência de cidades para sua viagem." },
  { icon: "search", photo: "/foto-hero.jpg", title: "Encontre jogos e organize tudo", body: "Busque partidas por clube, liga ou cidade, guarde no seu calendário e conte com ajuda humana se quiser fechar voos e hotéis." },
  { icon: "shieldBadge", photo: "/passport-exemplo.jpg", title: "Seu Passaporte de Estádios", body: "Registre os jogos que você viu, conquiste estádios, suba de nível e compartilhe sua jornada." },
];

function readSeen() {
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}

export function Onboarding({ onCreateAccount, onLogin }) {
  const [stage, setStage] = useState(() => (readSeen() ? "auth" : "slides"));
  const [i, setI] = useState(0);
  const touchX = useRef(null);

  const finishSlides = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* sem storage: só não lembra */ }
    setStage("auth");
  };
  const next = () => (i < SLIDES.length - 1 ? setI(i + 1) : finishSlides());

  const shell = { position: "fixed", inset: 0, zIndex: 40, background: "#fff", display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", boxSizing: "border-box", overflow: "hidden" };

  if (stage === "auth") {
    return (
      <div style={shell}>
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          <img src="/foto-hero.jpg" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(255,255,255,0.15), #fff 92%)" }} />
          <div style={{ position: "absolute", top: 24, left: 0, right: 0, display: "flex", justifyContent: "center" }}><Wordmark height={38} /></div>
        </div>
        <div style={{ padding: "0 24px 28px", display: "flex", flexDirection: "column", gap: 12, marginTop: -40, position: "relative" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, lineHeight: 1.1, color: TEXT, margin: 0 }}>Sua próxima viagem de futebol começa aqui</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 15, color: MUTED, margin: "0 0 8px" }}>Entre na sua conta ou crie uma grátis.</p>
          <div role="button" onClick={onCreateAccount} style={{ background: GREEN_BUTTON2, borderRadius: 14, padding: "16px 0", textAlign: "center", cursor: "pointer" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, textTransform: "uppercase", margin: 0 }}>Criar conta</p>
          </div>
          <div role="button" onClick={onLogin} style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 0", textAlign: "center", cursor: "pointer", background: "#fff" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, textTransform: "uppercase", margin: 0 }}>Entrar</p>
          </div>
        </div>
      </div>
    );
  }

  const s = SLIDES[i];
  return (
    <div
      style={shell}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx < -50) next();
        else if (dx > 50 && i > 0) setI(i - 1);
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
        <Wordmark height={28} />
        <p onClick={finishSlides} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: MUTED, margin: 0, cursor: "pointer", padding: 4 }}>Pular</p>
      </div>
      <div style={{ flex: 1, minHeight: 0, margin: "0 24px", borderRadius: 20, overflow: "hidden", position: "relative", background: "#f1f5f9" }}>
        <img key={s.photo} src={s.photo} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", left: 16, bottom: 16, width: 48, height: 48, borderRadius: 24, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(15,23,42,0.18)" }}>
          <Icon name={s.icon} size={24} color={GREEN} />
        </div>
      </div>
      <div style={{ padding: "24px 24px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, lineHeight: 1.1, color: TEXT, margin: 0 }}>{s.title}</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.5, color: MUTED, margin: 0, minHeight: 68 }}>{s.body}</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {SLIDES.map((_, k) => <div key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, background: k === i ? GREEN : BORDER, transition: "width .2s" }} />)}
          </div>
          <div role="button" onClick={next} style={{ background: GREEN_BUTTON2, borderRadius: 14, padding: "14px 28px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{i < SLIDES.length - 1 ? "Próximo" : "Começar"}</p>
            <Icon name="arrowRight" size={16} color={TEXT} />
          </div>
        </div>
      </div>
    </div>
  );
}
