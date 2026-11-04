"use client";
import { useEffect, useState } from "react";
import { text } from "../convite/ConviteUi";
import { timeAgo } from "../../lib/social";
import { getSocialNotifications, markSocialNotificationsSeen } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { Avatar } from "./ui";

const LINE = {
  follow: () => "começou a seguir você.",
  follow_request: () => "quer seguir você.",
  like: (n) => `curtiu sua publicação${n.postText ? `: “${n.postText}”` : "."}`,
  comment: (n) => `comentou${n.commentText ? `: “${n.commentText}”` : " na sua publicação."}`,
};

/** O que aconteceu com você na rede social: seguidores, pedidos, curtidas e comentários. Ao abrir, zera a bolinha do sino. */
export function AtividadeSocial({ onNavigate }) {
  const [state, setState] = useState({ status: "loading", items: [] });
  useEffect(() => {
    let alive = true;
    getSocialNotifications().then(async (r) => {
      if (!alive) return;
      if (!r.ok) return setState({ status: "error", items: [] });
      setState({ status: "ready", items: r.items });
      if (r.unread > 0) {
        await markSocialNotificationsSeen();
        window.dispatchEvent(new Event("tripsz:notifs")); // o sino atualiza o contador
      }
    });
    return () => { alive = false; };
  }, []);

  const open = (n) => {
    if (n.type === "follow_request") return onNavigate("amigos");
    if (n.type === "like" || n.type === "comment") return onNavigate("perfil");
    return onNavigate("usuario", n.actor.username);
  };
  if (state.status === "loading") return <p style={text(13, MUTED)}>Carregando...</p>;
  if (state.status === "error") return <p style={text(13, MUTED)}>Não foi possível carregar as notificações agora.</p>;
  if (state.items.length === 0) return <p style={text(13, MUTED)}>Nada de novo por aqui. Quando alguém seguir, curtir ou comentar, aparece aqui.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {state.items.map((n) => (
        <div key={n.id} role="button" aria-label={`Abrir notificação de @${n.actor.username}`} onClick={() => open(n)} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}>
          <Avatar url={n.actor.avatarUrl} name={n.actor.displayName} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={text(14, TEXT)}><span style={{ fontWeight: 700 }}>{n.actor.displayName}</span> {LINE[n.type](n)}</p>
            <p style={text(12, MUTED)}>@{n.actor.username} · {timeAgo(n.createdAt)}</p>
          </div>
          {n.unread && <span aria-label="Nova" style={{ width: 10, height: 10, borderRadius: 5, background: GREEN, marginTop: 6, flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  );
}
