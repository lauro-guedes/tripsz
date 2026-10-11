"use client";
import { AlertCircle, RotateCw } from "lucide-react";
import { BG, BG_ALT, BODY, BORDER, FONT_DISPLAY, GREEN_DARK, MUTED, TEXT } from "../../../lib/tokens";

/** Bloco cinza que "brilha" enquanto os dados carregam (o @keyframes mora no modal). */
export function Skeleton({ height = 16, width = "100%", radius = 8, style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height,
        width,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${BG_ALT} 25%, #e8edf3 37%, ${BG_ALT} 63%)`,
        backgroundSize: "400% 100%",
        animation: "tripszShimmer 1.4s ease infinite",
        ...style,
      }}
    />
  );
}

/** Esqueleto genérico de uma aba enquanto carrega. */
export function TabLoading() {
  return (
    <div role="status" aria-label="Carregando os dados do jogo" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Skeleton height={22} width="45%" />
      <Skeleton height={14} width="70%" />
      <Skeleton height={150} radius={12} />
      <Skeleton height={14} width="85%" />
      <Skeleton height={14} width="60%" />
    </div>
  );
}

/** "Sem dados" / "erro" com o mesmo visual (e botão de tentar de novo, se houver). */
export function EmptyNote({ title, text, onRetry }) {
  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
      <div style={{ background: BG_ALT, width: 40, height: 40, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AlertCircle size={20} color={MUTED} />
      </div>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{title}</p>
      {text && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, lineHeight: 1.5, color: BODY, margin: 0, maxWidth: 420 }}>{text}</p>}
      {onRetry && (
        <div onClick={onRetry} role="button" style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", marginTop: 4 }}>
          <RotateCw size={14} color={GREEN_DARK} />
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN_DARK, margin: 0 }}>Tentar de novo</p>
        </div>
      )}
    </div>
  );
}

/** Título + subtítulo de uma seção (Estádio, Estatísticas). */
export function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, lineHeight: "normal", color: TEXT, margin: 0 }}>{title}</p>
      {subtitle && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.5, color: MUTED, margin: 0 }}>{subtitle}</p>}
    </div>
  );
}
