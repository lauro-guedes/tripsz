"use client";
import { Check, Clock, X } from "lucide-react";
import { useState } from "react";
import { initials, namesLabel } from "../../../lib/companions";
import { BORDER, GREEN, MUTED, TEXT } from "../../../lib/tokens";
import { AMBER_BG, Message, PrimaryBtn, SLATE_BG, SecondaryBtn, text } from "../../convite/ConviteUi";
import { useIsMobile } from "../../ui/useIsMobile";
import { ConvidarModal } from "./ConvidarModal";
import { Avatar, SheetHandle, matchLabel, matchPlace, matchTitle, mono, useBodyLock } from "./ui";
import { useReenviar } from "./useReenviar";
import { useSheetDrag } from "./useSheetDrag";

const ORIGIN = { api: "Via Tripsz", csv: "Importado", manual: "Manual", invite: "Por convite" };

/** Modal "Detalhes do jogo": o registro e "Quem foi com você" (amigos marcados e convites). */
export function DetalhesJogoModal({ game, info, onClose, onRefresh }) {
  const isMobile = useIsMobile();
  useBodyLock();
  const { dragY, dragging, dragProps } = useSheetDrag(onClose);
  const [inviting, setInviting] = useState(false);
  const again = useReenviar({ game, onDone: onRefresh });
  const people = (info && info.people) || [];
  const invites = (info && info.invites) || [];
  const accepted = people.filter((p) => p.state === "accepted").map((p) => p.firstName);
  const where = [game.city, game.country].filter(Boolean).join(", ");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, overscrollBehavior: "contain", background: "rgba(15,23,42,0.6)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 24 }}>
      <div role="dialog" aria-modal="true" aria-label="Detalhes do jogo" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: isMobile ? "100%" : 560, borderRadius: isMobile ? "20px 20px 0 0" : 12, padding: isMobile ? 20 : 24, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16, maxHeight: isMobile ? "92vh" : "calc(100vh - 48px)", overflowY: "auto", overscrollBehavior: "contain", transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragging ? "none" : "transform 0.2s ease" }}>
        {isMobile && (
          <div style={{ margin: "-20px -20px -8px" }}>
            <SheetHandle onClose={onClose} dragProps={dragProps} />
          </div>
        )}
        <div {...(isMobile ? dragProps(false) : {})} style={{ display: "flex", gap: 12, alignItems: "center", touchAction: isMobile ? "none" : undefined }}>
          <p style={{ ...text(20, TEXT, { fontWeight: 700 }), flex: 1 }}>Detalhes do jogo</p>
          <span role="button" aria-label="Fechar" onClick={onClose} style={{ cursor: "pointer", display: "flex" }}>
            <X size={20} color={TEXT} />
          </span>
        </div>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {matchLabel(game) && <p style={mono(10)}>{matchLabel(game)}</p>}
          <p style={text(20, TEXT, { fontWeight: 700 })}>{matchTitle(game)}</p>
          {matchPlace(game) && <p style={text(13, MUTED)}>{matchPlace(game)}</p>}
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <p style={mono(10)}>Seu registro</p>
            <p style={text(13, TEXT, { marginTop: 4 })}>{ORIGIN[game.source] || ORIGIN.manual}</p>
          </div>
          {where && (
            <div style={{ flex: 1, minWidth: 120 }}>
              <p style={mono(10)}>Destino</p>
              <p style={text(13, TEXT, { marginTop: 4 })}>{where}</p>
            </div>
          )}
        </div>
        <div style={{ background: BORDER, height: 1 }} />
        <p style={text(20, TEXT, { fontWeight: 700 })}>Quem foi com você</p>
        <p style={text(13)}>
          {people.length + invites.length === 0 ? "Ninguém marcado nesse jogo ainda. Convide quem estava com você." : `Vocês compartilharam a arquibancada${game.stadium ? ` no ${game.stadium}` : ""}.${accepted.length ? ` Esse jogo também está no Passaporte de ${namesLabel(accepted)}.` : ""}`}
        </p>
        {people.map((p) => (
          <div key={p.username} style={{ borderBottom: `1px solid ${BORDER}`, padding: "8px 0", display: "flex", gap: 12, alignItems: "center" }}>
            <Avatar label={initials(p.firstName)} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <p style={text(14, TEXT, { fontWeight: 700 })}>{p.firstName}</p>
              <p style={text(12)}>@{p.username}</p>
              <p style={text(11)}>{p.by === "tagger" ? "Te marcou · Jogo no Passaporte" : p.by === "inviter" ? "Te convidou · Jogo no Passaporte" : p.state === "accepted" ? "Marcado por você · Jogo no Passaporte" : "Marcado por você · Aguardando aceite"}</p>
            </div>
            {p.state === "accepted" ? <Check size={18} color={GREEN} aria-label="No Passaporte" /> : <Clock size={18} color="#a16207" aria-label="Aguardando aceite" />}
          </div>
        ))}
        {invites.map((inv) => {
          const expired = inv.status === "expired";
          const first = String(inv.inviteeName).trim().split(/\s+/)[0];
          return (
            <div key={inv.id} style={{ background: expired ? SLATE_BG : AMBER_BG, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Clock size={16} color={expired ? MUTED : "#a16207"} />
                <p style={text(12, TEXT, { fontWeight: 700 })}>{inv.inviteeName} · {expired ? "Convite expirado" : "Convite pendente"}</p>
              </div>
              <p style={text(11)}>{expired ? `Este link não pode mais ser resgatado. Envie um novo convite para ${first} guardar o jogo.` : `O jogo entra no Passaporte quando ${first} criar a conta pelo convite.`}</p>
              {expired && <SecondaryBtn onClick={() => again.resend(inv)} disabled={again.busyId === inv.id}>{again.busyId === inv.id ? "Gerando novo link..." : "Reenviar convite"}</SecondaryBtn>}
            </div>
          );
        })}
        <Message msg={again.note} />
        <SecondaryBtn onClick={() => setInviting(true)}>+ Convidar mais alguém</SecondaryBtn>
        <PrimaryBtn onClick={onClose}>Voltar aos meus jogos</PrimaryBtn>
      </div>
      {inviting && <ConvidarModal game={game} onClose={() => setInviting(false)} onCreated={() => onRefresh && onRefresh()} onTagged={() => onRefresh && onRefresh()} selectedUsernames={people.map((p) => p.username)} />}
    </div>
  );
}
