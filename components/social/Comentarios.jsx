"use client";
import { Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Message, text } from "../convite/ConviteUi";
import { COMMENT_MAX } from "../../lib/socialPostRules";
import { timeAgo } from "../../lib/social";
import { addComment, getComments, removeComment, reportComment } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { ReportSheet } from "./ProfileMenu";
import { Avatar, Sheet } from "./ui";

/** Comentários de um post: ler, comentar, apagar (o seu, ou qualquer um se o post é seu) e denunciar. `onCount(n)` avisa o novo total. */
export function Comentarios({ post, onClose, onCount }) {
  const [list, setList] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // trava imediata contra toque duplo
  const [error, setError] = useState(null);
  const [reporting, setReporting] = useState(null);

  useEffect(() => {
    let alive = true;
    getComments(post.id).then((r) => {
      if (!alive) return;
      if (r.ok) setList(r.comments);
      else { setList([]); setError({ type: "error", text: r.message }); }
    });
    return () => { alive = false; };
  }, [post.id]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const r = await addComment(post.id, body);
      if (!r.ok) return setError({ type: "error", text: r.message });
      const next = [...(list || []), r.comment];
      setList(next);
      setDraft("");
      onCount(next.length);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };
  const remove = async (c) => {
    const r = await removeComment(c.id);
    if (!r.ok) return setError({ type: "error", text: r.message });
    const next = list.filter((x) => x.id !== c.id);
    setList(next);
    onCount(next.length);
  };

  if (reporting)
    return (
      <ReportSheet
        title="Denunciar comentário"
        intro={`Por que você quer denunciar o comentário de @${reporting.author.username}? Quem comentou não saberá que foi você.`}
        send={(reason, details) => reportComment(reporting.id, reason, details)}
        onClose={() => setReporting(null)}
        doneBody="Obrigado por avisar. Vamos analisar o comentário."
      />
    );
  return (
    <Sheet title="Comentários" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 80 }}>
        {list === null && <p style={text(13, MUTED)}>Carregando...</p>}
        {list && list.length === 0 && <p style={text(13, MUTED)}>Ninguém comentou ainda. Seja o primeiro!</p>}
        {(list || []).map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Avatar url={c.author.avatarUrl} name={c.author.displayName} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={text(13, TEXT, { fontWeight: 700 })}>{c.author.displayName} <span style={{ fontWeight: 500, color: MUTED, fontSize: 11 }}>@{c.author.username} · {timeAgo(c.createdAt)}</span></p>
              <p style={{ ...text(14, TEXT), whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.body}</p>
            </div>
            {c.canDelete ? (
              <div role="button" aria-label={`Apagar comentário de @${c.author.username}`} onClick={() => remove(c)} style={{ cursor: "pointer", padding: 4, display: "flex" }}><Trash2 size={17} color={MUTED} /></div>
            ) : (
              <p role="button" aria-label={`Denunciar comentário de @${c.author.username}`} onClick={() => setReporting(c)} style={{ ...text(11, MUTED), cursor: "pointer", textDecoration: "underline" }}>Denunciar</p>
            )}
          </div>
        ))}
      </div>
      <Message msg={error} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: `1px solid ${BORDER}`, paddingTop: 12, paddingBottom: 4, position: "sticky", bottom: 0, background: "#fff" }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, COMMENT_MAX))} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escreva um comentário..." enterKeyHint="send" aria-label="Escreva um comentário" style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "11px 16px", fontSize: 16, fontFamily: FONT_DISPLAY, outline: "none" }} />
        <div role="button" aria-label="Enviar comentário" aria-disabled={!draft.trim() || sending} onClick={send} style={{ width: 42, height: 42, borderRadius: 999, background: draft.trim() ? GREEN : "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", cursor: draft.trim() ? "pointer" : "default" }}><Send size={18} color="#fff" /></div>
      </div>
    </Sheet>
  );
}
