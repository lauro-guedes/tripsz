"use client";
import { useAuthedUser } from "../jogos/acompanhantes/useAcompanhantes";
import { SheetHandle, useBodyLock } from "../jogos/acompanhantes/ui";
import { useSheetDrag } from "../jogos/acompanhantes/useSheetDrag";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { useIsMobile } from "../ui/useIsMobile";
import { text } from "../convite/ConviteUi";
import { initialsOf } from "../../lib/social";
import { BG, BORDER, FONT_DISPLAY, GREEN, GREEN_BUTTON2, MUTED, TEXT } from "../../lib/tokens";

export const MAX_W = 480; // largura das telas sociais (desenhadas pro celular); no computador ficam centralizadas

/** Casca das telas sociais: navegação do app em cima e uma coluna de celular no meio. */
export function SocialShell({ onNavigate, onLogout, children }) {
  const user = useAuthedUser();
  return (
    <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
      <AuthedNav active="perfil" userName={user.name} userAvatar={user.avatar} onNavigate={onNavigate} onLogout={onLogout} />
      <div style={{ maxWidth: MAX_W, margin: "0 auto", width: "100%", background: BG }}>{children}</div>
      <AuthedFooter />
    </div>
  );
}

/** Foto da pessoa; sem foto, as iniciais num círculo verde. */
export function Avatar({ url, name, size = 44, ring = false }) {
  const base = { width: size, height: size, borderRadius: 999, flexShrink: 0, overflow: "hidden", background: GREEN_BUTTON2, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", border: ring ? "4px solid #fff" : "none" };
  return (
    <div style={base} data-testid="avatar">
      {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: Math.round(size * 0.36), color: "#fff", margin: 0, lineHeight: 1 }}>{initialsOf(name)}</p>}
    </div>
  );
}

/** Abas de texto (Posts, Check-ins...). */
export function Tabs({ tabs, value, onChange, label = "Abas" }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: `1px solid ${BORDER}`, background: "#fff" }}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <div key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)} style={{ padding: "14px 16px", cursor: "pointer", whiteSpace: "nowrap", borderBottom: `2px solid ${on ? GREEN : "transparent"}`, flex: "1 0 auto", textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: on ? 700 : 500, fontSize: 14, color: on ? GREEN : MUTED, margin: 0 }}>{t.label}{t.count != null ? <span style={{ fontWeight: 500, color: MUTED }}> ({t.count})</span> : null}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Botão pequeno (Seguir, Seguindo, Aceitar...). `kind`: solid (verde) | outline. */
export function SmallBtn({ kind = "solid", onClick, disabled, children, label }) {
  const solid = kind === "solid";
  return (
    <div role="button" aria-label={label} aria-disabled={!!disabled} onClick={disabled ? undefined : onClick} style={{ background: solid ? GREEN : "#fff", border: `1px solid ${solid ? GREEN : BORDER}`, borderRadius: 999, padding: "9px 20px", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: solid ? "#fff" : TEXT, margin: 0 }}>{children}</p>
    </div>
  );
}

export function Chip({ on, onClick, children }) {
  return (
    <div role="button" aria-pressed={!!on} onClick={onClick} style={{ border: `1px solid ${on ? GREEN : BORDER}`, background: on ? "rgba(0,200,83,0.1)" : "#fff", borderRadius: 999, padding: "9px 16px", cursor: "pointer" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: on ? 700 : 500, fontSize: 13, color: on ? "#008a3a" : TEXT, margin: 0 }}>{children}</p>
    </div>
  );
}

export function EmptyState({ title, body }) {
  return (
    <div style={{ padding: "40px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={text(15, TEXT, { fontWeight: 700 })}>{title}</p>
      {body && <p style={text(13, MUTED)}>{body}</p>}
    </div>
  );
}

/** Folha de baixo (celular) / janela no meio (computador), com alça e travando a página de fundo. */
export function Sheet({ title, onClose, children }) {
  const isMobile = useIsMobile();
  useBodyLock();
  const { dragY, dragging, dragProps } = useSheetDrag(onClose);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 24, overscrollBehavior: "contain" }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: isMobile ? "100%" : 440, borderRadius: isMobile ? "20px 20px 0 0" : 16, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box", transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragging ? "none" : "transform 0.2s ease" }}>
        {isMobile && <SheetHandle onClose={onClose} dragProps={dragProps} />}
        <div style={{ padding: isMobile ? "8px 20px 24px" : 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={text(18, TEXT, { fontWeight: 700 })}>{title}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
