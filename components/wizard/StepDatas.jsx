"use client";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BG, MUTED, TEXT } from "../../lib/tokens";
import { MobileProgress, WIZARD_TOTAL, WizardBottomBar, WizardTopBar } from "../nav/WizardChrome";
import { maxSearchDate, todayInSaoPaulo } from "../../lib/calendarUtils";
import { useIsMobile } from "../ui/useIsMobile";
import { Calendar } from "lucide-react";
import { useRef, useState } from "react";

const fmtBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

/**
 * Campo de data com o rótulo DENTRO ("Data de Ida" / "Data de Volta") quando
 * ainda está vazio. O <input type="date"> de verdade fica por cima, invisível,
 * então o toque abre o calendário nativo do aparelho.
 */
function DateField({ label, value, min, max, onChange, isMobile }) {
  const ref = useRef(null);
  const open = () => {
    try {
      ref.current?.showPicker?.();
    } catch {
      // navegador sem showPicker: o toque direto no campo já abre o calendário
    }
  };
  return (
    <div style={{ position: "relative", background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: isMobile ? "14px 16px" : "16px 24px", borderRadius: 8, cursor: "pointer" }}>
      <Calendar size={20} color={TEXT} />
      <p style={{ flex: 1, margin: 0, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: value ? TEXT : MUTED }}>{value ? fmtBR(value) : label}</p>
      <input
        ref={ref}
        type="date"
        aria-label={label}
        value={value || ""}
        min={min}
        max={max}
        onClick={open}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0, margin: 0, fontSize: 16 }}
      />
    </div>
  );
}

export function StepDatas({ answers, setAnswers, onNext, onBack, onHome, stepOffset = 0 }) {
  const isMobile = useIsMobile();
  const flexLevel = answers.flexLevel || "fixed";
  const FLEX_OPTS = [{ id: "fixed", label: "Datas fixas" }, { id: "some", label: "Posso variar alguns dias" }, { id: "flex", label: "Bastante flexibilidade" }];
  const [error, setError] = useState(null);
  // A volta é preenchida com a data da ida (pro calendário da volta abrir no mês certo).
  // Enquanto a pessoa não mexer nela, acompanha a ida.
  const [endAuto, setEndAuto] = useState(false);

  const TOO_FAR = "Só dá pra montar viagens dos próximos 6 meses — os calendários além disso ainda não foram divulgados.";
  // Valida de verdade: o atributo max do campo de data não impede de digitar.
  const checkDates = (start, end) => {
    const today = todayInSaoPaulo();
    const max = maxSearchDate();
    if (!start || !end) return "Escolha a data de ida e a data de volta antes de continuar.";
    if (start < today || end < today) return "Escolha datas de hoje em diante.";
    if (start > max || end > max) return TOO_FAR;
    if (end < start) return "A data de volta não pode ser antes da ida.";
    return null;
  };

  const handleNext = () => {
    const problem = checkDates(answers.dateStart, answers.dateEnd);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <WizardTopBar step={4 - stepOffset} total={WIZARD_TOTAL - stepOffset} onExit={onBack} onLogoClick={onHome} />
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 56, alignItems: isMobile ? "flex-start" : "center", padding: isMobile ? "24px 16px" : "40px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: isMobile ? "flex-start" : "center", textAlign: isMobile ? "left" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Quando você quer viajar?</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 600, margin: 0 }}>Escolha a data de ida, a data de volta e diga o quanto pode flexibilizar</p>
        </div>
        {isMobile && <MobileProgress step={4 - stepOffset} total={WIZARD_TOTAL - stepOffset} />}
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Data de Ida e Data de Volta</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, width: isMobile ? "100%" : 800 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Data de Ida</p>
              <DateField
                label="Data de Ida"
                value={answers.dateStart}
                min={todayInSaoPaulo()}
                max={maxSearchDate()}
                isMobile={isMobile}
                onChange={(newStart) => {
                  if (newStart && (newStart > maxSearchDate() || newStart < todayInSaoPaulo())) {
                    setError(newStart > maxSearchDate() ? TOO_FAR : "Escolha datas de hoje em diante.");
                    setAnswers((a) => ({ ...a, dateStart: "", dateEnd: "" }));
                    setEndAuto(false);
                    return;
                  }
                  setError(null);
                  // Volta vazia, antes da nova ida ou ainda "automática": acompanha a ida,
                  // pra o calendário da volta abrir no mês da ida.
                  const follow = !answers.dateEnd || endAuto || answers.dateEnd < newStart;
                  if (follow) setEndAuto(true);
                  setAnswers((a) => ({ ...a, dateStart: newStart, dateEnd: follow ? newStart : a.dateEnd }));
                }}
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Data de Volta</p>
              <DateField
                label="Data de Volta"
                value={answers.dateEnd}
                min={answers.dateStart || todayInSaoPaulo()}
                max={maxSearchDate()}
                isMobile={isMobile}
                onChange={(newEnd) => {
                  if (newEnd && (newEnd > maxSearchDate() || newEnd < (answers.dateStart || todayInSaoPaulo()))) {
                    setError(newEnd > maxSearchDate() ? TOO_FAR : "A data de volta não pode ser antes da ida.");
                    setAnswers((a) => ({ ...a, dateEnd: "" }));
                    return;
                  }
                  setError(null);
                  setEndAuto(false);
                  setAnswers((a) => ({ ...a, dateEnd: newEnd }));
                }}
              />
              {endAuto && answers.dateStart && answers.dateEnd === answers.dateStart && (
                <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: GREEN, margin: 0 }}>Preenchemos a volta com a data da ida — toque no campo e escolha o dia em que você volta.</p>
              )}
              {answers.dateStart && (
                <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, margin: 0 }}>
                  Escolha a volta a partir de {answers.dateStart.split("-").reverse().join("/")} (dia da ida).
                </p>
              )}
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, margin: 0 }}>Datas até 6 meses à frente.</p>
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: BORDER, width: isMobile ? "100%" : 800 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Flexibilidade</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: isMobile ? 8 : 12, justifyContent: "center", width: isMobile ? "100%" : 800 }}>
            {FLEX_OPTS.map((o) => {
              const active = flexLevel === o.id;
              return (
                <div key={o.id} onClick={() => setAnswers((a) => ({ ...a, flexLevel: o.id }))} style={{ background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, padding: isMobile ? "14px 16px" : "16px 24px", borderRadius: 8, cursor: "pointer", width: isMobile ? "100%" : "auto" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 14 : 16, color: active ? GREEN : TEXT, margin: 0 }}>{o.label}</p>
                </div>
              );
            })}
          </div>
        </div>
        {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0, textAlign: isMobile ? "left" : "center" }}>{error}</p>}
      </div>
      <WizardBottomBar onBack={onBack} onNext={handleNext} />
    </div>
  );
}
