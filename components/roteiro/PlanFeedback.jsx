"use client";
import { BODY, FONT_DISPLAY, GOLD_BG, GOLD_BORDER, MUTED } from "../../lib/tokens";
import { Button } from "../ui/Button";

// Avisos do plano (sem jogo nas datas, time favorito que não joga, local provável...)
// + estados de carregando/erro. A plataforma diz o que fez e o que NÃO conseguiu.
export function PlanFeedback({ loading, error, notes, empty, onRetry }) {
  if (loading) {
    return <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Montando seu roteiro com os jogos reais...</p>;
  }
  if (error) {
    return (
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#b91c1c", margin: 0 }}>{error}</p>
        {onRetry && <Button variant="outline" small onClick={onRetry}>Tentar de novo</Button>}
      </div>
    );
  }
  const list = (notes || []).filter((n) => n && n.message);
  if (list.length === 0 && !empty) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map((n, i) => (
        <div key={i} style={{ background: GOLD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, lineHeight: 1.4, color: BODY, margin: 0 }}>{n.message}</p>
        </div>
      ))}
      {empty && list.length === 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Ainda não há jogos para mostrar neste roteiro.</p>}
    </div>
  );
}
