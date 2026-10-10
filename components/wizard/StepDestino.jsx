"use client";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BG, TEXT } from "../../lib/tokens";
import { MobileProgress, WIZARD_TOTAL, WizardBottomBar, WizardTopBar } from "../nav/WizardChrome";
import { Pill } from "../ui/Pill";
import { useIsMobile } from "../ui/useIsMobile";
import { Globe } from "lucide-react";
import { useState } from "react";

export const COUNTRIES_BY_CONTINENT = {
  eu: ["Inglaterra", "Espanha", "Itália", "Alemanha", "França", "Portugal", "Holanda", "Turquia"],
  sa: ["Argentina", "Brasil", "Uruguai", "Chile", "Colômbia"],
};

export function StepDestino({ answers, setAnswers, onNext, onBack, onHome, stepOffset = 0 }) {
  const isMobile = useIsMobile();
  const continents = answers.continents || [];
  const countries = answers.countries || [];
  const [error, setError] = useState(null);
  const toggleContinent = (id) => setAnswers((a) => ({ ...a, continents: continents.includes(id) ? continents.filter((x) => x !== id) : [...continents, id] }));
  const toggleCountry = (c) => setAnswers((a) => ({ ...a, countries: countries.includes(c) ? countries.filter((x) => x !== c) : [...countries, c] }));
  const availableCountries = continents.flatMap((id) => COUNTRIES_BY_CONTINENT[id] || []);

  const handleNext = () => {
    if (countries.length === 0) {
      setError("Escolha ao menos um país antes de continuar.");
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <WizardTopBar step={2 - stepOffset} total={WIZARD_TOTAL - stepOffset} onExit={onBack} onLogoClick={onHome} />
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 40, alignItems: isMobile ? "flex-start" : "center", padding: isMobile ? "24px 16px" : "40px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: isMobile ? "flex-start" : "center", textAlign: isMobile ? "left" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Para onde você quer ir?</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 600, margin: 0 }}>Escolha um ou mais continentes — depois você pode refinar por país de sua preferência.</p>
        </div>
        {isMobile && <MobileProgress step={2 - stepOffset} total={WIZARD_TOTAL - stepOffset} />}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 16, justifyContent: "center", width: "100%" }}>
          {[{ id: "sa", label: "América do Sul" }, { id: "eu", label: "Europa" }].map((c) => {
            const active = continents.includes(c.id);
            return (
              <div key={c.id} onClick={() => toggleContinent(c.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: isMobile ? "100%" : 180, padding: "16px 20px", borderRadius: 8, background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, cursor: "pointer" }}>
                <Globe size={20} color={active ? GREEN : TEXT} />
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: active ? 700 : 500, fontSize: 14, color: active ? GREEN : TEXT }}>{c.label}</span>
              </div>
            );
          })}
        </div>
        {availableCountries.length > 0 && (
          <>
            <div style={{ height: 1, background: BORDER, width: isMobile ? "100%" : 800 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
              <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: GREEN, textTransform: "uppercase", margin: 0 }}>Pressione para selecionar os países</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: isMobile ? "flex-start" : "center", width: isMobile ? "100%" : 900 }}>
                {availableCountries.map((c) => <Pill key={c} active={countries.includes(c)} onClick={() => toggleCountry(c)}>{c}</Pill>)}
              </div>
            </div>
          </>
        )}
        {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0, textAlign: "center" }}>{error}</p>}
      </div>
      <WizardBottomBar onBack={onBack} onNext={handleNext} mutedBack />
    </div>
  );
}
