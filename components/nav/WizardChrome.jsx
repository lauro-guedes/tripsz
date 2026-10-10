"use client";
import { BG_ALT, BORDER, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";
import { Wordmark } from "../ui/Wordmark";
import { useIsMobile } from "../ui/useIsMobile";

/* Shared wizard chrome */
export const WIZARD_TOTAL = 6;

// Barra de progresso "Passo X de 5 / Y% Concluído" usada no topo de cada
// tela do questionário no mobile (Figma 125:129, 125:196, 125:252, etc.),
// substituindo os 5 círculos numerados do desktop, que não cabem numa tela estreita.
export function MobileProgress({ step, total = WIZARD_TOTAL }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Passo {step} de {total}</p>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, margin: 0 }}>{pct}% Concluído</p>
      </div>
      <div style={{ background: BORDER, height: 6, borderRadius: 100, width: "100%", overflow: "hidden" }}>
        <div style={{ background: GREEN_BUTTON, height: "100%", width: `${pct}%`, borderRadius: 100 }} />
      </div>
    </div>
  );
}

export function WizardTopBar({ step, onExit, onLogoClick, total = WIZARD_TOTAL }) {
  const isMobile = useIsMobile();
  const pct = Math.round((step / total) * 100);
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "flex-start", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", width: "100%", background: "#fff" }}>
          <Wordmark height={26} onClick={onLogoClick} />
          <p onClick={onExit} style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, cursor: "pointer", margin: 0 }}>Sair</p>
        </div>
        <div style={{ height: 1, background: BORDER, width: "100%" }} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "flex-start", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 80px", width: "100%" }}>
        <Wordmark onClick={onLogoClick} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", width: 360 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontFamily: FONT_MONO, fontSize: 12 }}>
            <span style={{ color: GREEN, textTransform: "uppercase" }}>Passo {step} de {total}</span>
            <span style={{ color: MUTED }}>{pct}% Concluído</span>
          </div>
          <div style={{ width: "100%", height: 4, borderRadius: 2, background: BORDER, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: GREEN_BUTTON }} />
          </div>
        </div>
        <p onClick={onExit} style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, cursor: "pointer", margin: 0 }}>Sair do questionário</p>
      </div>
      <div style={{ height: 1, background: BORDER, width: "100%" }} />
    </div>
  );
}

export function WizardBottomBar({ onBack, onNext, nextLabel = "Continuar", mutedBack }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ width: "100%" }}>
      <div style={{ height: 1, background: BORDER, width: "100%" }} />
      <div style={{ background: BG_ALT, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "16px" : "24px 80px", width: "100%" }}>
        <div onClick={onBack} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "12px 20px" : "14px 24px", borderRadius: 8, cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 13 : 14, color: mutedBack ? MUTED : TEXT, textTransform: "uppercase", margin: 0 }}>Voltar</p>
        </div>
        <div onClick={onNext} style={{ background: GREEN_BUTTON, display: "flex", gap: 6, alignItems: "center", justifyContent: "center", padding: isMobile ? "12px 24px" : "14px 24px", borderRadius: 8, cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 13 : 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{nextLabel}</p>
          <Icon name="arrowRight" size={isMobile ? 12 : 16} color={TEXT} />
        </div>
      </div>
    </div>
  );
}
