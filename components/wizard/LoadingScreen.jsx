"use client";
import { BG, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD_BORDER, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { useIsMobile } from "../ui/useIsMobile";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LoadingScreen({ onWork, onDone }) {
  const isMobile = useIsMobile();
  const [activeIdx, setActiveIdx] = useState(0);
  const lines = ["Cruzando calendários por país e data...", "Listando partidas possíveis...", "Organizando sequência de cidades...", "Preparando o roteiro..."];

  // O trabalho de verdade (buscar os jogos reais e salvar o roteiro) começa já,
  // em paralelo com a animação. O ref garante que rode UMA vez só (o modo
  // estrito do React monta os efeitos duas vezes em desenvolvimento).
  const workRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!workRef.current) workRef.current = Promise.resolve().then(() => (onWork ? onWork() : null)).catch((e) => { console.error(e); return null; });
      // Mostra cada etapa por um tempinho, uma de cada vez, e só avança
      // pra tela seguinte depois que a última etapa apareceu E o trabalho terminou.
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return;
        setActiveIdx(i);
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      const next = await workRef.current;
      if (!cancelled) onDone(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "0 16px" : 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 32 : 48, alignItems: "center", width: "100%" }}>
        <div style={{ width: isMobile ? 80 : 100, height: isMobile ? 80 : 100, borderRadius: "50%", border: `3px solid ${BORDER}`, borderTopColor: GREEN, animation: "spin 1.1s linear infinite" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 16, alignItems: "center", textAlign: "center" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 22 : 28, color: TEXT, margin: 0 }}>Construindo sua jornada perfeita...</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, color: GREEN, margin: 0 }}>{`"${lines[activeIdx]}"`}</p>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? 18 : 24, width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 12 }}>
          {lines.map((line, i) => (
            <div key={line} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {i < activeIdx ? <Check size={14} color={GREEN} /> : <div style={{ width: 6, height: 6, borderRadius: "50%", background: i === activeIdx ? GOLD_BORDER : BORDER, flexShrink: 0 }} />}
              <span style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 12 : 13, color: i < activeIdx ? MUTED : i === activeIdx ? TEXT : MUTED, fontWeight: i === activeIdx ? 700 : 400 }}>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
