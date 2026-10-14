"use client";
import { Card, Message, PrimaryBtn, text } from "../../convite/ConviteUi";
import { BORDER, GREEN_DARK, MUTED, TEXT } from "../../../lib/tokens";
import { useIsMobile } from "../../ui/useIsMobile";
import { BuscaAmigos } from "./BuscaAmigos";
import { ConvidarModal } from "./ConvidarModal";
import { GameMini, PageShell, mono } from "./ui";
import { useAcompanhantes, useAuthedUser } from "./useAcompanhantes";

/** Última etapa do registro: "Quem foi com você?". O jogo já está salvo; aqui se marcam os amigos e se convida quem não tem conta. */
export function QuemFoiComVoce({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const user = useAuthedUser();
  const s = useAcompanhantes({ onNavigate });
  if (!s.draft) return null;
  const game = s.draft.game;

  const actions = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: isMobile ? "100%" : 360, alignSelf: "flex-end" }}>
      <Message msg={s.error ? { type: "error", text: s.error } : null} />
      <PrimaryBtn onClick={s.save} disabled={s.saving}>{s.saving ? "Salvando..." : "Salvar jogo"}</PrimaryBtn>
      <p role="button" onClick={s.skip} style={text(13, GREEN_DARK, { fontWeight: 600, textAlign: "center", cursor: "pointer", lineHeight: "normal" })}>Pular</p>
    </div>
  );

  return (
    <PageShell user={user} isMobile={isMobile} onNavigate={onNavigate} onLogout={onLogout}>
      <p role="button" onClick={() => onNavigate("registrar-jogo")} style={text(12, MUTED, { fontWeight: 600, cursor: "pointer", lineHeight: "normal" })}>← Registrar jogo</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={mono(10)}>Última etapa · Acompanhantes</p>
        <h1 style={text(isMobile ? 26 : 32, TEXT, { fontWeight: 700, lineHeight: 1.3 })}>Quem foi com você?</h1>
        <p style={text(14)}>Marque quem estava na arquibancada. Quem já está no tripsz recebe um aviso para guardar esse jogo.</p>
      </div>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, alignItems: "flex-start" }}>
        <div style={{ width: isMobile ? "100%" : 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <GameMini game={game} />
          <Card>
            <p style={text(15, TEXT, { fontWeight: 700 })}>Seu registro, em boa companhia</p>
            <p style={text(13)}>Amigos marcados recebem um aviso para adicionar esse jogo ao Passaporte. Quem ainda não está no tripsz pode entrar por convite.</p>
          </Card>
        </div>
        <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined }}>
          <BuscaAmigos s={s} />
        </div>
      </div>
      <div style={isMobile ? { position: "sticky", bottom: 0, background: "#f8fafc", borderTop: `1px solid ${BORDER}`, margin: "0 -16px -32px", padding: "12px 16px", zIndex: 5 } : { display: "flex", justifyContent: "flex-end" }}>{actions}</div>
      {s.inviting && <ConvidarModal game={game} onClose={() => s.setInviting(false)} onCreated={(inv) => s.setInvited((l) => [...l, inv])} />}
    </PageShell>
  );
}
