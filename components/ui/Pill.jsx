"use client";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_BG, TEXT } from "../../lib/tokens";
import { Check } from "lucide-react";

export function Pill({ active, onClick, children }) {
  return (
    <div onClick={onClick} style={{ background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "12px 16px", borderRadius: 6, cursor: "pointer" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: active ? GREEN : TEXT, margin: 0, whiteSpace: "nowrap" }}>{children}</p>
      {active && <Check size={14} color={GREEN} />}
    </div>
  );
}
