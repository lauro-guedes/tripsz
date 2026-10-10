"use client";
import { FONT_DISPLAY, MUTED } from "../../lib/tokens";

/* Estado de carregamento padrão: símbolo da Tripsz + texto, centralizados. */
export function Loading({ text = "Carregando...", compact = false, style }) {
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: compact ? 10 : 16, padding: compact ? "20px 0" : "80px 24px", width: "100%", boxSizing: "border-box", ...style }}>
      <img src="/simbolo-tripsz.svg" alt="" width={compact ? 38 : 56} height={compact ? 32 : 48} style={{ display: "block", animation: "tripsz-pulse 1.4s ease-in-out infinite" }} />
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: compact ? 13 : 14, color: MUTED, margin: 0, textAlign: "center" }}>{text}</p>
    </div>
  );
}
