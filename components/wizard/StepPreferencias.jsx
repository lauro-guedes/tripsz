"use client";
import { paceRangeLabel } from "../../lib/paceRules";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BG, TEXT } from "../../lib/tokens";
import { MobileProgress, WIZARD_TOTAL, WizardBottomBar, WizardTopBar } from "../nav/WizardChrome";
import { useIsMobile } from "../ui/useIsMobile";
import { Check } from "lucide-react";

export function StepPreferencias({ answers, setAnswers, onNext, onBack, onHome, stepOffset = 0 }) {
  const isMobile = useIsMobile();
  const priority = answers.priority || "classics";
  const pace = answers.pace || "spaced";
  const PRIORITIES = [["maxgames", "Máximo de jogos"], ["stadiums", "Mais estádios"], ["classics", "Clássicos prioritários"], ["international", "Competições internacionais"]];
  const PACES = [["compact", "Mais compacto"], ["balanced", "Equilibrado"], ["spaced", "Mais espaçado"], ["relaxed", "Mais relaxado"]];

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <WizardTopBar step={6 - stepOffset} total={WIZARD_TOTAL - stepOffset} onExit={onBack} onLogoClick={onHome} />
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48, alignItems: isMobile ? "flex-start" : "center", padding: isMobile ? "24px 16px" : "40px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: isMobile ? "flex-start" : "center", textAlign: isMobile ? "left" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Como quer cruzar as partidas?</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 600, margin: 0 }}>Último passo - nos conte suas prioridades para cruzar partidas possíveis nos países e datas selecionados</p>
        </div>
        {isMobile && <MobileProgress step={6 - stepOffset} total={WIZARD_TOTAL - stepOffset} />}
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Prioridade do roteiro</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: isMobile ? 8 : 12, justifyContent: isMobile ? "flex-start" : "center", width: isMobile ? "100%" : 800 }}>
            {PRIORITIES.map(([id, label]) => {
              const active = priority === id;
              return (
                <div key={id} onClick={() => setAnswers((a) => ({ ...a, priority: id }))} style={{ background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, display: "flex", gap: 8, alignItems: "center", justifyContent: isMobile ? "space-between" : "flex-start", padding: 16, borderRadius: 8, cursor: "pointer", width: isMobile ? "100%" : "auto" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: active ? GREEN : TEXT, margin: 0 }}>{label}</p>
                  {active && <Check size={12} color={GREEN} />}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Ritmo do roteiro</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 12, width: isMobile ? "100%" : 800 }}>
            {PACES.map(([id, label]) => {
              const active = pace === id;
              return (
                <div key={id} onClick={() => setAnswers((a) => ({ ...a, pace: id }))} style={{ flex: isMobile ? "none" : 1, background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, display: "flex", flexDirection: isMobile ? "row" : "column", gap: 8, alignItems: "center", justifyContent: isMobile ? "space-between" : "center", height: isMobile ? "auto" : 72, padding: isMobile ? 14 : 0, borderRadius: isMobile ? 8 : 12, cursor: "pointer" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: isMobile ? "flex-start" : "center" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: active ? GREEN : TEXT, margin: 0 }}>{label}</p>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: active ? GREEN : BODY, margin: 0 }}>({paceRangeLabel(id)})</p>
                  </div>
                  {active && <Check size={12} color={GREEN} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <WizardBottomBar onBack={onBack} onNext={onNext} nextLabel="Cruzar partidas →" mutedBack />
    </div>
  );
}
