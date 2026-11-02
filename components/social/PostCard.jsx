"use client";
import { Heart, MessageCircle, MoreHorizontal } from "lucide-react";
import { text } from "../convite/ConviteUi";
import { timeAgo } from "../../lib/social";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { Avatar } from "./ui";

const VIS = { public: "Público", friends: "Seguidores", private: "Só eu" };
const dmy = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

/** Fotos do post: 1 grande; 2 lado a lado; 3 uma grande e duas; 4 em grade. */
export function PhotoGrid({ photos }) {
  if (!photos || photos.length === 0) return null;
  const img = (src, h, key) => <img key={key} src={src} alt="Foto da publicação" loading="lazy" style={{ width: "100%", height: h, objectFit: "cover", borderRadius: 12, display: "block" }} />;
  if (photos.length === 1) return img(photos[0], 240, 0);
  if (photos.length === 2) return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>{photos.map((p, i) => img(p, 180, i))}</div>;
  if (photos.length === 3) return <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 4 }}>{img(photos[0], 204, 0)}<div style={{ display: "grid", gap: 4 }}>{img(photos[1], 100, 1)}{img(photos[2], 100, 2)}</div></div>;
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>{photos.map((p, i) => img(p, 120, i))}</div>;
}

/** Uma publicação (post ou check-in) como aparece no feed e no perfil. */
export function PostCard({ post, onLike, onComments, onMenu, onOpenProfile }) {
  const p = post;
  // "San Siro · Inter Milan × AC Milan · 27/09/2026"
  const context = [p.stadium.name, p.game && `${p.game.home} × ${p.game.away}`, p.game && dmy(p.game.date)].filter(Boolean).join(" · ");
  return (
    <article aria-label={`Publicação de @${p.author.username}`} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div role="button" aria-label={`Abrir perfil de @${p.author.username}`} onClick={() => onOpenProfile(p.author.username)} style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0, cursor: "pointer" }}>
          <Avatar url={p.author.avatarUrl} name={p.author.displayName} size={42} />
          <div style={{ minWidth: 0 }}>
            <p style={text(15, TEXT, { fontWeight: 700 })}>{p.author.displayName}</p>
            <p style={text(12, MUTED)}>@{p.author.username} · {timeAgo(p.createdAt)} · {VIS[p.visibility] || "Público"}</p>
          </div>
        </div>
        {p.kind === "checkin" && <span style={{ background: "rgba(0,200,83,0.12)", color: GREEN_DARK, borderRadius: 999, padding: "4px 10px", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11 }}>Check-in</span>}
        <div role="button" aria-label="Mais opções da publicação" onClick={() => onMenu(p)} style={{ cursor: "pointer", display: "flex", padding: 4 }}><MoreHorizontal size={20} color={MUTED} /></div>
      </div>
      {p.body && <p style={{ ...text(14, TEXT), whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{p.body}</p>}
      <p style={text(12, GREEN_DARK, { fontWeight: 600 })}>{context}</p>
      <PhotoGrid photos={p.photos} />
      <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
        <div role="button" aria-pressed={p.likedByMe} aria-label={p.likedByMe ? "Descurtir" : "Curtir"} onClick={() => onLike(p)} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <Heart size={22} color={p.likedByMe ? "#e11d48" : TEXT} fill={p.likedByMe ? "#e11d48" : "none"} />
          <span style={text(14, TEXT, { fontWeight: 600 })}>{p.likes}</span>
        </div>
        <div role="button" aria-label="Comentários" onClick={() => onComments(p)} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <MessageCircle size={22} color={TEXT} />
          <span style={text(14, TEXT, { fontWeight: 600 })}>{p.comments}</span>
        </div>
      </div>
    </article>
  );
}
