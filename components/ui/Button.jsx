"use client";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";

export function Button({ children, icon, variant = "primary", onClick, small }) {
  const styles = {
    primary: { background: GREEN_BUTTON, color: TEXT, border: "none" },
    primaryDark: { background: GREEN, color: "#fff", border: "none" },
    secondary: { background: "#fff", color: TEXT, border: `1px solid ${BORDER}` },
    secondaryMuted: { background: "#fff", color: MUTED, border: `1px solid ${BORDER}` },
    outline: { background: "#fff", color: GREEN, border: `1.5px solid ${GREEN}` },
  };
  return (
    <div onClick={onClick} style={{ display: "inline-flex", gap: 8, alignItems: "center", justifyContent: "center", padding: small ? "10px 20px" : "14px 24px", borderRadius: 8, cursor: "pointer", ...styles[variant] }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: small ? 13 : 14, textTransform: "uppercase", margin: 0, whiteSpace: "nowrap" }}>{children}</p>
      {icon}
    </div>
  );
}
