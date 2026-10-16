"use client";
import { X } from "lucide-react";
import { useState } from "react";
import { BORDER, GREEN, GREEN_DARK, MUTED, TEXT } from "../../../lib/tokens";
import { GREEN_TINT, text } from "../../convite/ConviteUi";
import { useIsMobile } from "../../ui/useIsMobile";
import { ConvidarExistente } from "./ConvidarExistente";
import { ConvidarNovo } from "./ConvidarNovo";
import { SheetHandle, matchPlace, matchTitle, useBodyLock } from "./ui";
import { useSheetDrag } from "./useSheetDrag";

const MODES = [["existing", "Já está no tripsz"], ["new", "Ainda não está"]];
const SUBTITLE = {
  existing: "Marque um amigo que já usa o tripsz. Ele recebe um aviso para adicionar esse jogo ao Passaporte.",
  new: "Convide quem dividiu a arquibancada com você, mesmo sem uma conta no tripsz.",
};

/**
 * Modal "Convidar alguém": marcar quem JÁ está no tripsz (por @) ou convidar quem ainda não está (WhatsApp, e-mail,
 * link ou compartilhamento do aparelho). Folha de baixo pra cima no celular, com alça pra minimizar; a página de fundo fica travada.
 *  - onPickFriend(p): se vier, marcar um amigo só ADICIONA na lista da tela (que salva depois); se não vier, a marcação é feita na hora.
 *  - onTagged(p): chamado depois de marcar na hora. selectedUsernames: quem já está marcado nesse jogo.
 */
export function ConvidarModal({ game, onClose, onCreated, onPickFriend, onTagged, selectedUsernames = [], initialMode = "new" }) {
  const isMobile = useIsMobile();
  useBodyLock();
  const [mode, setMode] = useState(initialMode);
  const { dragY, dragging, dragProps } = useSheetDrag(onClose);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 24, boxSizing: "border-box", overscrollBehavior: "contain" }}>
      <div role="dialog" aria-modal="true" aria-label="Convidar alguém" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: isMobile ? "100%" : 600, borderRadius: isMobile ? "20px 20px 0 0" : 12, boxSizing: "border-box", display: "flex", flexDirection: "column", maxHeight: isMobile ? "92dvh" : "calc(100dvh - 48px)", overflowY: "auto", overscrollBehavior: "contain", transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragging ? "none" : "transform 0.2s ease" }}>
        {isMobile && <SheetHandle onClose={onClose} dragProps={dragProps} />}
        <div style={{ padding: isMobile ? "8px 20px 20px" : 28, display: "flex", flexDirection: "column", gap: 20 }}>
          <div {...(isMobile ? dragProps(false) : {})} style={{ display: "flex", gap: 12, alignItems: "center", touchAction: isMobile ? "none" : undefined }}>
            <p style={{ ...text(22, TEXT, { fontWeight: 700 }), flex: 1 }}>Convidar alguém</p>
            <span role="button" aria-label="Fechar" onClick={onClose} style={{ cursor: "pointer", display: "flex" }}>
              <X size={20} color={TEXT} />
            </span>
          </div>
          <p style={text(13)}>{SUBTITLE[mode]}</p>
          <div style={{ background: GREEN_TINT, borderRadius: 12, padding: "5px 9px", alignSelf: "flex-start" }}>
            <p style={text(10, GREEN_DARK, { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, lineHeight: "normal" })}>{[matchTitle(game), game.stadium && matchPlace({ stadium: game.stadium })].filter(Boolean).join(" · ")}</p>
          </div>
          <div role="group" aria-label="Quem você quer adicionar" style={{ display: "flex", gap: 8 }}>
            {MODES.map(([k, label]) => {
              const on = mode === k;
              return (
                <div key={k} role="button" aria-pressed={on} onClick={() => setMode(k)} style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 12, border: `1px solid ${on ? GREEN : BORDER}`, background: on ? GREEN_TINT : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <p style={text(12, on ? GREEN_DARK : MUTED, { fontWeight: 600, lineHeight: "normal" })}>{label}</p>
                </div>
              );
            })}
          </div>
          {mode === "existing" ? (
            <ConvidarExistente game={game} onClose={onClose} onPickFriend={onPickFriend} onTagged={onTagged} selectedUsernames={selectedUsernames} goNew={() => setMode("new")} />
          ) : (
            <ConvidarNovo game={game} onClose={onClose} onCreated={onCreated} />
          )}
        </div>
      </div>
    </div>
  );
}
