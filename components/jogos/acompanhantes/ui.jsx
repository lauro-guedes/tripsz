"use client";
import { MapPin, X } from "lucide-react";
import { useEffect } from "react";
import { formatShortDate } from "../../../lib/gameDetailsCore";
import { initials } from "../../../lib/companions";
import { teamLabel } from "../../../lib/textUtils";
import { BG, BORDER, FONT_MONO, GREEN, GREEN_DARK, MUTED, TEXT } from "../../../lib/tokens";
import { AuthedFooter } from "../../nav/AuthedFooter";
import { AuthedNav } from "../../nav/AuthedNav";
import { AMBER_BG, GREEN_TINT, SLATE_BG, SecondaryBtn, text } from "../../convite/ConviteUi";

export const mono = (size = 10, color = MUTED) => text(size, color, { fontFamily: FONT_MONO, lineHeight: 1.4, textTransform: "uppercase" });

/* ---------- o jogo, em frases ---------- */
export const matchTitle = (g) => `${teamLabel(g.home_team)} ${g.home_score != null && g.away_score != null ? `${g.home_score}×${g.away_score}` : "×"} ${teamLabel(g.away_team)}`;
export const matchPlace = (g) => [g.stadium, g.city].filter(Boolean).join(" · ");
export const matchLabel = (g) => [g.competition, formatShortDate(g.match_date)].filter(Boolean).join(" · ");

let lockCount = 0; // quantos modais estão abertos (um por cima do outro): a trava só sai quando fecha o último
let lockSaved = null;

/**
 * Trava a página de trás DE VERDADE enquanto um modal está aberto: `overflow: hidden` sozinho não segura a rolagem no
 * iPhone, então o body é congelado na posição atual e a rolagem volta ao mesmo ponto ao fechar.
 */
export function useBodyLock() {
  useEffect(() => {
    const b = document.body.style;
    if (lockCount++ === 0) {
      const y = window.scrollY;
      lockSaved = { y, position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow };
      b.position = "fixed";
      b.top = `-${y}px`;
      b.left = "0";
      b.right = "0";
      b.width = "100%";
      b.overflow = "hidden";
    }
    return () => {
      if (--lockCount === 0 && lockSaved) {
        const { y, ...prev } = lockSaved;
        Object.assign(b, prev);
        lockSaved = null;
        window.scrollTo(0, y);
      }
    };
  }, []);
}

/** A alça no topo da folha do celular: tocar ou arrastar pra baixo minimiza. */
export function SheetHandle({ onClose, dragProps }) {
  return (
    <div data-testid="alca" role="button" aria-label="Minimizar" onClick={onClose} {...dragProps(true)} style={{ display: "flex", justifyContent: "center", padding: "12px 0 6px", flexShrink: 0, cursor: "pointer", touchAction: "none" }}>
      <div style={{ background: BORDER, width: 44, height: 5, borderRadius: 999 }} />
    </div>
  );
}

/** Página das telas novas: menu de cima, conteúdo com o respiro do design e rodapé. */
export function PageShell({ user, isMobile, onNavigate, onLogout, children }) {
  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="jogos" userName={user.name} userAvatar={user.avatar} onNavigate={onNavigate} onLogout={onLogout} />
      <div style={{ padding: isMobile ? "24px 16px 32px" : "40px 140px 48px", display: "flex", flexDirection: "column", gap: 24 }}>{children}</div>
      <AuthedFooter />
    </div>
  );
}

export function Avatar({ label, size = 40 }) {
  return (
    <div style={{ background: GREEN_TINT, border: "2px solid #fff", width: size, height: size, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box" }}>
      <p style={text(size >= 40 ? 13 : 10, GREEN_DARK, { fontWeight: 700, lineHeight: "normal" })}>{label}</p>
    </div>
  );
}

/** Dois avatares sobrepostos + "Com Ana e Bruno". */
export function PeopleAvatars({ names, label }) {
  const shown = names.slice(0, 2);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ display: "flex" }}>
        {shown.map((n, i) => (
          <div key={i} style={{ marginRight: i < shown.length - 1 ? -7 : 0 }}>
            <Avatar label={initials(n)} size={28} />
          </div>
        ))}
      </div>
      <p style={text(13, TEXT, { fontWeight: 600, lineHeight: "normal" })}>{label}</p>
    </div>
  );
}

/** Quem foi marcado, antes de salvar. `note` = "Marcado, aguardando aceite" (quem já tem conta aceita depois). */
export function Chip({ person, note, onRemove }) {
  return (
    <div style={{ background: GREEN_TINT, border: `1px solid ${GREEN}`, borderRadius: 12, padding: "7px 10px", display: "flex", gap: 8, alignItems: "center" }}>
      <Avatar label={initials(person.firstName)} size={28} />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <p style={text(13, TEXT, { fontWeight: 600, lineHeight: "normal" })}>{person.firstName}</p>
        {note && <p style={text(10, MUTED, { lineHeight: "normal" })}>{note}</p>}
      </div>
      {onRemove && (
        <span role="button" aria-label={`Desmarcar ${person.firstName}`} onClick={onRemove} style={{ cursor: "pointer", display: "flex" }}>
          <X size={14} color={MUTED} />
        </span>
      )}
    </div>
  );
}

export function FriendRow({ person, marked, onToggle }) {
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "12px 0", display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar label={initials(person.firstName)} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <p style={text(14, TEXT, { fontWeight: 700 })}>{person.firstName}</p>
        <p style={text(12)}>@{person.username}</p>
      </div>
      <div style={{ flexShrink: 0 }}>
        <SecondaryBtn onClick={onToggle}>{marked ? "Marcado ✓" : "Marcar"}</SecondaryBtn>
      </div>
    </div>
  );
}

/** Cartão compacto do jogo (competição e data, placar, estádio). */
export function GameMini({ game }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {matchLabel(game) && <p style={mono(10)}>{matchLabel(game)}</p>}
      <p style={text(18, TEXT, { fontWeight: 700 })}>{matchTitle(game)}</p>
      {matchPlace(game) && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <MapPin size={16} color={MUTED} />
          <p style={text(13, MUTED, { lineHeight: "normal" })}>{matchPlace(game)}</p>
        </div>
      )}
    </div>
  );
}

const STATUS = { pending: { bg: AMBER_BG, color: "#a16207", label: "Pendente" }, claimed: { bg: GREEN_TINT, color: GREEN_DARK, label: "Cadastrou" }, expired: { bg: SLATE_BG, color: MUTED, label: "Expirado" } };
const CHANNEL = { whatsapp: "Enviado por WhatsApp", email: "Convite por e-mail", link: "Link compartilhado" };
const MESSAGE = {
  pending: (n) => `Quando ${n} criar a conta, o jogo entra no Passaporte dele(a).`,
  claimed: (n) => `${n} criou a conta e resgatou o convite. O jogo já está no Passaporte dele(a).`,
  expired: (n) => `Este link não pode mais ser resgatado. Envie um novo convite para ${n} guardar o jogo.`,
};

/** "Seus convites": um convite, com o status e (se expirou) "Reenviar convite". */
export function InviteCard({ invite, busy, onResend }) {
  const st = STATUS[invite.status] || STATUS.pending;
  const first = String(invite.inviteeName || "").trim().split(/\s+/)[0] || "a pessoa";
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Avatar label={initials(invite.inviteeName)} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <p style={text(14, TEXT, { fontWeight: 700 })}>{invite.inviteeName}</p>
          <p style={text(11)}>{CHANNEL[invite.channel] || CHANNEL.link}</p>
        </div>
        <div style={{ background: st.bg, borderRadius: 12, padding: "5px 8px", flexShrink: 0 }}>
          <p style={text(11, st.color, { fontWeight: 600, lineHeight: "normal" })}>{st.label}</p>
        </div>
      </div>
      <p style={text(12)}>{MESSAGE[invite.status](first)}</p>
      {invite.status === "expired" && onResend && <SecondaryBtn onClick={onResend} disabled={busy}>{busy ? "Gerando novo link..." : "Reenviar convite"}</SecondaryBtn>}
    </div>
  );
}
