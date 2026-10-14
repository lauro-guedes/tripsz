"use client";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { clearDraft, readDraft, saveDraft } from "../../../lib/companionDraft";
import { namesLabel } from "../../../lib/companions";
import { listInvites } from "../../../lib/companionsClient";
import { GREEN_DARK, TEXT } from "../../../lib/tokens";
import { Card, GREEN_TINT, Message, PrimaryBtn, SecondaryBtn, text } from "../../convite/ConviteUi";
import { useIsMobile } from "../../ui/useIsMobile";
import { ConvidarModal } from "./ConvidarModal";
import { GameMini, InviteCard, PageShell, PeopleAvatars, mono } from "./ui";
import { useAuthedUser } from "./useAcompanhantes";
import { useReenviar } from "./useReenviar";

/** Confirmação: "Jogo salvo no seu Passaporte", com quem foi marcado e os convites ("Seus convites"). */
export function JogoSalvo({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const user = useAuthedUser();
  const [draft] = useState(() => readDraft());
  const [tagged, setTagged] = useState(() => ((readDraft() || {}).tagged) || []); // quem foi marcado (nesta tela ou na etapa anterior)
  const [invites, setInvites] = useState(null);
  const [inviting, setInviting] = useState(false);
  const loadInvites = async () => {
    const r = await listInvites(draft.game.id);
    setInvites(r.ok ? r.invites : []);
  };
  const again = useReenviar({ game: draft ? draft.game : {}, onDone: loadInvites });

  useEffect(() => {
    if (!draft) onNavigate("jogos"); // abriu direto pela URL, sem jogo recém-salvo
    else loadInvites();
  }, []);
  if (!draft) return null;

  const game = draft.game;
  const names = tagged.map((p) => p.firstName);
  const addTagged = (p) => {
    if (tagged.some((x) => x.username === p.username)) return;
    const next = [...tagged, p];
    setTagged(next);
    saveDraft({ ...draft, tagged: next });
  };
  const many = names.length > 1;
  const back = () => {
    clearDraft();
    onNavigate("jogos");
  };

  return (
    <PageShell user={user} isMobile={isMobile} onNavigate={onNavigate} onLogout={onLogout}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: GREEN_TINT, width: 52, height: 52, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={28} color={GREEN_DARK} />
        </div>
        <p style={mono(10)}>Registro concluído</p>
        <h1 style={text(isMobile ? 26 : 32, TEXT, { fontWeight: 700, lineHeight: 1.3 })}>Jogo salvo no seu Passaporte</h1>
        <p style={text(14)}>A lembrança é sua. E agora pode fazer parte da história de quem foi com você.</p>
      </div>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, alignItems: "flex-start" }}>
        <div style={{ width: isMobile ? "100%" : 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <GameMini game={game} />
          {names.length > 0 && (
            <Card>
              <PeopleAvatars names={names} label={`Com ${namesLabel(names)}`} />
              <p style={text(12)}>{namesLabel(names)} já {many ? "estão" : "está"} no tripsz. {many ? "Eles receberam" : "Recebeu"} um aviso para adicionar o jogo ao Passaporte.</p>
            </Card>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={text(18, TEXT, { fontWeight: 700 })}>Seus convites</p>
          {invites === null && <p style={text(13)}>Carregando...</p>}
          {invites && invites.length === 0 && <p style={text(13)}>Você ainda não convidou ninguém para esse jogo. Quem não tem conta no tripsz pode entrar por convite.</p>}
          {(invites || []).map((inv) => (
            <InviteCard key={inv.id} invite={inv} busy={again.busyId === inv.id} onResend={() => again.resend(inv)} />
          ))}
          <Message msg={again.note} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: isMobile ? "100%" : 360 }}>
          <PrimaryBtn onClick={() => setInviting(true)}>+ Convidar mais alguém</PrimaryBtn>
          <SecondaryBtn onClick={back}>Voltar aos meus jogos</SecondaryBtn>
        </div>
      </div>
      {inviting && <ConvidarModal game={game} onClose={() => setInviting(false)} onCreated={() => loadInvites()} onTagged={addTagged} selectedUsernames={tagged.map((p) => p.username)} />}
    </PageShell>
  );
}
