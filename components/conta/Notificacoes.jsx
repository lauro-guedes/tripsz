"use client";
import { BG_ALT, BODY, BORDER, FONT_DISPLAY, TEXT } from "../../lib/tokens";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { MarcacoesPendentes } from "../jogos/acompanhantes/MarcacoesPendentes";
import { useAuthedUser } from "../jogos/acompanhantes/useAcompanhantes";
import { useIsMobile } from "../ui/useIsMobile";

/** Tela "Notificações" (menu do usuário): amigos que te marcaram em um jogo, com Adicionar ao Passaporte ou Ignorar. */
export function Notificacoes({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const user = useAuthedUser();
  const px = isMobile ? "16px" : "80px";
  return (
    <div style={{ background: BG_ALT, width: "100%", minHeight: "100vh" }}>
      <AuthedNav active="notificacoes" userName={user.name} userAvatar={user.avatar} onNavigate={onNavigate} onLogout={onLogout} />
      <div style={{ padding: isMobile ? `24px ${px} 32px` : `40px ${px} 48px` }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: TEXT, margin: 0 }}>Notificações</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Amigos que te marcaram em um jogo. O jogo só entra no seu Passaporte se você aceitar.</p>
          <MarcacoesPendentes emptyText="Você não tem notificações no momento." />
        </div>
      </div>
      <AuthedFooter />
    </div>
  );
}
