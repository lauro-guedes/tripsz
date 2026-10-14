"use client";
import { Search, UserSearch } from "lucide-react";
import { useState } from "react";
import { tagCompanions } from "../../../lib/companionsClient";
import { BORDER, MUTED, TEXT } from "../../../lib/tokens";
import { LinkBtn, Message, PrimaryBtn, text } from "../../convite/ConviteUi";
import { FriendRow, mono } from "./ui";
import { useFriendSearch } from "./useFriendSearch";

/** "Já está no tripsz": busca pelo @ EXATO e marca o amigo (ele recebe um aviso; o jogo não entra sozinho na conta dele). */
export function ConvidarExistente({ game, onClose, onPickFriend, onTagged, selectedUsernames, goNew }) {
  const f = useFriendSearch();
  const [marked, setMarked] = useState([]); // @ marcados nesta janela (marcação feita na hora)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const isMarked = (u) => selectedUsernames.includes(u) || marked.includes(u);
  const q = f.query.trim();

  const pick = async (p) => {
    if (busy || isMarked(p.username)) return;
    setMsg(null);
    if (onPickFriend) {
      // A tela que abriu este modal guarda a lista e salva depois (botão "Salvar jogo").
      const err = onPickFriend(p); // a tela devolve um texto se NÃO conseguiu marcar (ex.: limite de 10 amigos)
      if (typeof err === "string") return setMsg({ type: "error", text: err });
      return setMsg({ type: "info", text: `Marcamos ${p.firstName}. O aviso vai quando você salvar o jogo.` });
    }
    setBusy(true);
    const r = await tagCompanions(game.id, [p.username]);
    setBusy(false);
    if (!r.ok) return setMsg({ type: "error", text: r.message });
    setMarked((m) => [...m, p.username]);
    if (onTagged) onTagged({ username: p.username, firstName: p.firstName, state: "waiting" });
    setMsg({ type: "info", text: `Marcamos ${p.firstName}. A pessoa recebe um aviso para adicionar o jogo ao Passaporte.` });
  };

  return (
    <>
      <div>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, minHeight: 48, padding: "0 14px", display: "flex", alignItems: "center", gap: 10, boxSizing: "border-box" }}>
          <Search size={18} color={MUTED} />
          <input value={f.query} onChange={(e) => f.setQuery(e.target.value)} placeholder="Buscar amigo pelo @" aria-label="Buscar amigo pelo @" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 14, color: TEXT, padding: "12px 0" }} />
        </div>
        <p style={text(11, MUTED, { marginTop: 6 })}>Busque pelo @ exato do seu amigo (ex.: @ana.santos), com pelo menos 3 letras.</p>
      </div>
      <div>
        {q.length >= 3 ? (
          <>
            {f.result.state === "loading" && <p style={text(12)}>Buscando...</p>}
            {f.result.state === "error" && <p role="alert" style={text(12, "#b91c1c", { fontWeight: 600 })}>{f.result.message}</p>}
            {f.result.state === "found" && (
              <>
                <p style={mono(10)}>Resultado da busca</p>
                <FriendRow person={f.result.friend} marked={isMarked(f.result.friend.username)} onToggle={() => pick(f.result.friend)} />
              </>
            )}
            {f.result.state === "none" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 0", textAlign: "center" }}>
                <UserSearch size={32} color={MUTED} />
                <p style={text(15, TEXT, { fontWeight: 700 })}>Nenhum usuário encontrado para “{q}”</p>
                <p style={text(12)}>Essa pessoa ainda não está no tripsz? Convide por link, WhatsApp ou e-mail.</p>
                <LinkBtn onClick={goNew}>Convidar quem ainda não está</LinkBtn>
              </div>
            )}
          </>
        ) : f.friends.length > 0 ? (
          <>
            <p style={mono(10)}>Sugestões de amigos</p>
            {f.friends.map((p) => (
              <FriendRow key={p.username} person={p} marked={isMarked(p.username)} onToggle={() => pick(p)} />
            ))}
          </>
        ) : null}
      </div>
      <Message msg={msg} />
      <PrimaryBtn onClick={onClose}>Concluir</PrimaryBtn>
    </>
  );
}
