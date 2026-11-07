"use client";
import { ChevronRight, History, MapPin, SquarePen } from "lucide-react";
import { text } from "../convite/ConviteUi";
import { BORDER, FONT_DISPLAY, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { ScreenHeader, SocialShell } from "./ui";

const OPTIONS = [
  { key: "checkin", title: "Fazer check-in", body: "Estou no estádio agora. Registre sua presença em um jogo de hoje.", tag: "PRESENÇA ATUAL", icon: MapPin },
  { key: "registrar-jogo", title: "Adicionar jogo passado", body: "Encontre uma partida ou cadastre manualmente uma experiência que já viveu.", tag: "REGISTRO HISTÓRICO", icon: History },
  { key: "post-novo", title: "Criar publicação", body: "Compartilhe fotos e histórias com a torcida. Não registra presença.", tag: "NO FEED", icon: SquarePen },
];

/** O "+" da barra de baixo: uma tela com as 3 formas de registrar. */
export function CentralMais({ onNavigate, onLogout }) {
  return (
    <SocialShell onNavigate={onNavigate} onLogout={onLogout}>
      <ScreenHeader title="O que vamos registrar?" onBack={() => window.history.back()} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, color: TEXT, margin: 0 }}>Sua história de arquibancada.</h2>
          <p style={{ ...text(14, MUTED), marginTop: 6 }}>Escolha como quer compartilhar este momento.</p>
        </div>
        {OPTIONS.map(({ key, title, body, tag, icon: Icon }) => (
          <div key={key} role="button" aria-label={title} onClick={() => onNavigate(key)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, padding: 16, display: "flex", gap: 14, cursor: "pointer" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(0,200,83,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={24} color={GREEN_DARK} /></div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: TEXT, margin: 0 }}>{title}</p>
              <p style={text(13, MUTED)}>{body}</p>
              <span style={{ alignSelf: "flex-start", background: "rgba(0,200,83,0.12)", color: GREEN_DARK, borderRadius: 999, padding: "5px 12px", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 11 }}>{tag}</span>
            </div>
            <ChevronRight size={20} color={MUTED} style={{ alignSelf: "center" }} />
          </div>
        ))}
      </div>
    </SocialShell>
  );
}
