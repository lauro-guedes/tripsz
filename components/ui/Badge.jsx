"use client";
import { FONT_MONO, GOLD, GOLD_BG, GOLD_BORDER, GREEN, GREEN_BG } from "../../lib/tokens";

export function Badge({ children, gold }) {
  return (
    <div style={{ background: gold ? GOLD_BG : GREEN_BG, border: `1px solid ${gold ? GOLD_BORDER : GREEN}`, display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 4 }}>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: gold ? GOLD : GREEN, textTransform: "uppercase", margin: 0, whiteSpace: "nowrap" }}>{children}</p>
    </div>
  );
}
