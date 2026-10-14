"use client";
import { useEffect, useState } from "react";
import { initials } from "../../../lib/companions";
import { acceptRequest, fetchCompanionRequests, ignoreRequest } from "../../../lib/companionsClient";
import { BORDER, TEXT } from "../../../lib/tokens";
import { Message, PrimaryBtn, text } from "../../convite/ConviteUi";
import { Avatar, matchLabel, matchPlace, matchTitle, mono } from "./ui";

/**
 * Avisos "Fulano te marcou em [jogo]" no topo de Meus Jogos. O jogo só entra no Passaporte se a pessoa aceitar
 * ("Adicionar ao meu Passaporte"); "Ignorar" não avisa quem marcou.
 */
export function MarcacoesPendentes({ onAccepted }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchCompanionRequests().then((r) => alive && r.ok && setItems(r.requests || []));
    return () => {
      alive = false;
    };
  }, []);

  const respond = async (item, action) => {
    if (busy) return;
    setBusy(item.id);
    setFlash(null);
    const r = action === "accept" ? await acceptRequest(item.id) : await ignoreRequest(item.id);
    setBusy(null);
    if (!r.ok) return setFlash({ type: "error", text: r.message });
    setItems((l) => l.filter((x) => x.id !== item.id));
    if (action === "ignore") return setFlash({ type: "info", text: "Aviso ignorado. Quem te marcou não é avisado." });
    setFlash({ type: "info", text: r.duplicate ? "Você já tinha esse jogo no seu Passaporte." : "Jogo adicionado ao seu Passaporte." });
    if (onAccepted) await onAccepted();
  };

  if (items.length === 0 && !flash) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={mono(10)}>Jogos em que te marcaram</p>
      {items.map((it) => (
        <div key={it.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Avatar label={initials(it.tagger.firstName)} />
            <p style={text(13, TEXT, { fontWeight: 600 })}>
              {it.tagger.firstName}
              {it.tagger.username ? ` (@${it.tagger.username})` : ""} te marcou em um jogo
            </p>
          </div>
          <div>
            {matchLabel(it.game) && <p style={mono(10)}>{matchLabel(it.game)}</p>}
            <p style={text(16, TEXT, { fontWeight: 700, marginTop: 4 })}>{matchTitle(it.game)}</p>
            {matchPlace(it.game) && <p style={text(13, undefined, { marginTop: 2 })}>{matchPlace(it.game)}</p>}
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", maxWidth: 300 }}>
              <PrimaryBtn onClick={() => respond(it, "accept")} disabled={busy === it.id}>{busy === it.id ? "Adicionando..." : "Adicionar ao meu Passaporte"}</PrimaryBtn>
            </div>
            <p role="button" onClick={() => respond(it, "ignore")} style={text(13, undefined, { fontWeight: 700, cursor: "pointer", lineHeight: "normal" })}>Ignorar</p>
          </div>
        </div>
      ))}
      <Message msg={flash} />
    </div>
  );
}
