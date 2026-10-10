"use client";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { MobileProgress, WIZARD_TOTAL, WizardBottomBar, WizardTopBar } from "../nav/WizardChrome";
import { useIsMobile } from "../ui/useIsMobile";
import { useState } from "react";

export function Counter({ label, value, onChange }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>{label}</p>
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderRadius: 8 }}>
        <div onClick={() => onChange(Math.max(0, value - 1))} style={{ background: BG_ALT, border: `1px solid ${BORDER}`, width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>−</p>
        </div>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{value}</p>
        <div onClick={() => onChange(value + 1)} style={{ background: BG_ALT, border: `1px solid ${BORDER}`, width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>+</p>
        </div>
      </div>
    </div>
  );
}

export function StepPessoasOrcamento({ answers, setAnswers, onNext, onBack, onHome, stepOffset = 0 }) {
  const isMobile = useIsMobile();
  const adults = answers.adults ?? 2;
  const kids = answers.kids ?? 0;
  const budget = answers.budget;
  const budgetOpts = ["R$ 5.000", "R$ 10.000", "R$ 20.000", "R$ 30.000+"];
  const [error, setError] = useState(null);

  const handleNext = () => {
    if (!answers.budget && !answers.budgetCustom) {
      setError("Escolha um orçamento (ou digite um valor) antes de continuar.");
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <WizardTopBar step={5 - stepOffset} total={WIZARD_TOTAL - stepOffset} onExit={onBack} onLogoClick={onHome} />
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48, alignItems: isMobile ? "flex-start" : "center", padding: isMobile ? "24px 16px" : "40px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: isMobile ? "flex-start" : "center", textAlign: isMobile ? "left" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Quem vai e qual o orçamento total da viagem?</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 600, margin: 0 }}>Informe o número de viajantes e o orçamento total estimado para a viagem</p>
        </div>
        {isMobile && <MobileProgress step={5 - stepOffset} total={WIZARD_TOTAL - stepOffset} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: isMobile ? "100%" : 800 }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Viajantes</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 24 }}>
            <Counter label="Adultos" value={adults} onChange={(v) => setAnswers((a) => ({ ...a, adults: v }))} />
            <Counter label="Crianças" value={kids} onChange={(v) => setAnswers((a) => ({ ...a, kids: v }))} />
          </div>
        </div>
        <div style={{ height: 1, background: BORDER, width: isMobile ? "100%" : 800 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Orçamento total da viagem</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: isMobile ? "flex-start" : "center", width: isMobile ? "100%" : 800 }}>
            {budgetOpts.map((o) => (
              <div key={o} onClick={() => setAnswers((a) => ({ ...a, budget: o, budgetCustom: "" }))} style={{ background: "#fff", border: `1px solid ${budget === o ? GREEN : BORDER}`, padding: "12px 16px", borderRadius: 999, cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: budget === o ? GREEN : TEXT, margin: 0 }}>{o}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: isMobile ? "100%" : 800 }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Outro valor total</p>
            <div style={{ background: "#fff", border: `1.5px solid ${BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "12px 16px", borderRadius: 8 }}>
              <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: TEXT }}>R$</span>
              <input
                value={answers.budgetCustom || ""}
                onChange={(e) => setAnswers((a) => ({ ...a, budgetCustom: e.target.value, budget: undefined }))}
                placeholder="Digite o orçamento total..."
                style={{ flex: 1, border: "none", outline: "none", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: TEXT }}
              />
            </div>
          </div>
        </div>
        {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0, textAlign: isMobile ? "left" : "center" }}>{error}</p>}
      </div>
      <WizardBottomBar onBack={onBack} onNext={handleNext} mutedBack />
    </div>
  );
}
