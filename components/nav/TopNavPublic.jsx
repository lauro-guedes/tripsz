"use client";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import { Button } from "../ui/Button";
import { Wordmark } from "../ui/Wordmark";
import { useIsMobile } from "../ui/useIsMobile";

export function TopNavPublic({ onStart, active, onLogin, onHome, onNavItem }) {
  const isMobile = useIsMobile();
  const items = [
    ["Como Funciona", "como-funciona"],
    ["Roteiros", "perfis-viajante"],
    ["Diferenciais", "diferenciais"],
    ["Passaporte", "passaporte"],
    ["Planos", "pricing"],
    ["FAQ", "faq"],
  ];
  const handleNavItem = (id) => {
    if (onNavItem) onNavItem(id);
  };
  if (isMobile) {
    return (
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <Wordmark height={28} onClick={onHome} />
        {onLogin ? (
          <div onClick={onLogin} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: TEXT, textTransform: "uppercase", margin: 0 }}>Entrar ou Criar Conta</p>
          </div>
        ) : (
          <div onClick={onStart} style={{ background: GREEN_BUTTON, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: TEXT, textTransform: "uppercase", margin: 0 }}>Montar viagem</p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 80px" }}>
      <Wordmark onClick={onHome} />
      <div style={{ display: "flex", gap: 32, alignItems: "center", fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14 }}>
        {items.map(([label, id]) => (
          <p key={id} onClick={() => handleNavItem(id)} style={{ color: label === active ? GREEN : MUTED, fontWeight: label === active ? 700 : 500, margin: 0, cursor: "pointer" }}>{label}</p>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {onLogin && (
          <div onClick={onLogin} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>Entrar ou Criar Conta</p>
          </div>
        )}
        <Button variant="primaryDark" onClick={onStart}>Montar minha viagem</Button>
      </div>
    </div>
  );
}
