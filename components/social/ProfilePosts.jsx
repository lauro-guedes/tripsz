"use client";
import { useEffect, useRef, useState } from "react";
import { Message } from "../convite/ConviteUi";
import { getProfilePosts } from "../../lib/socialClient";
import { text } from "../convite/ConviteUi";
import { MUTED, TEXT } from "../../lib/tokens";
import { EmptyState, Sheet, SmallBtn } from "./ui";
import { PostList } from "./PostList";

const EMPTY = {
  post: { self: ["Suas publicações vão aparecer aqui", "Publique fotos e histórias dos estádios que você já visitou."], other: ["Nada por aqui ainda", null] },
  checkin: { self: ["Seus check-ins vão aparecer aqui", "Quando você estiver no estádio, faça o check-in pelo botão +."], other: ["Nada por aqui ainda", null] },
};

/** Grade de fotos pequenas (3 por linha, como o perfil de uma rede de fotos). Sem foto: um quadrado com o começo do texto. */
function PostGrid({ posts, onOpen }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
      {posts.map((p) => (
        <div key={p.id} role="button" aria-label={`Abrir publicação sobre ${p.stadium.name}`} onClick={() => onOpen(p.id)} style={{ position: "relative", aspectRatio: "1 / 1", background: "#eef2f6", overflow: "hidden", cursor: "pointer" }}>
          {p.photos && p.photos[0] ? (
            <img src={p.photos[0]} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ padding: 8, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
              <p style={text(11, TEXT, { fontWeight: 600 })}>{(p.body || "").length > 70 ? `${p.body.slice(0, 70)}...` : p.body}</p>
              <p style={text(10, MUTED)}>{p.stadium.name}</p>
            </div>
          )}
          {p.photos && p.photos.length > 1 && <span aria-hidden="true" style={{ position: "absolute", top: 6, right: 6, background: "rgba(15,23,42,0.65)", color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{p.photos.length}</span>}
        </div>
      ))}
    </div>
  );
}

/** As publicações (kind "post") ou os check-ins (kind "checkin") de um perfil, nas abas do perfil. */
export function ProfilePosts({ username, kind, self, onNavigate }) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState({ hasMore: false, cursor: null });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const loadingMore = useRef(false);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    getProfilePosts(username, kind).then((r) => {
      if (!alive) return;
      if (!r.ok) { setError({ type: "error", text: r.message }); return setStatus("error"); }
      setError(null);
      setPosts(r.posts);
      setPage({ hasMore: r.hasMore, cursor: r.nextCursor });
      setStatus("ready");
    });
    return () => { alive = false; };
  }, [username, kind]);

  const more = async () => {
    if (loadingMore.current || !page.cursor) return;
    loadingMore.current = true;
    const r = await getProfilePosts(username, kind, page.cursor);
    loadingMore.current = false;
    if (!r.ok) return setError({ type: "error", text: r.message });
    setPosts((list) => [...list, ...r.posts.filter((p) => !list.some((x) => x.id === p.id))]);
    setPage({ hasMore: r.hasMore, cursor: r.nextCursor });
  };
  const [title, body] = EMPTY[kind][self ? "self" : "other"];

  return (
    <div style={{ padding: kind === "post" ? "8px 0 20px" : "12px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <Message msg={error} />
      {status === "loading" && <EmptyState title="Carregando..." />}
      {status === "ready" && posts.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <EmptyState title={title} body={body} />
          {self && <SmallBtn onClick={() => onNavigate(kind === "post" ? "post-novo" : "checkin")}>{kind === "post" ? "Nova publicação" : "Fazer check-in"}</SmallBtn>}
        </div>
      )}
      {kind === "post" ? (
        <>
          <PostGrid posts={posts} onOpen={setOpenId} />
          {openId && posts.some((p) => p.id === openId) && (
            <Sheet title="Publicação" onClose={() => setOpenId(null)}>
              <PostList posts={posts.filter((p) => p.id === openId)} setPosts={setPosts} onNavigate={onNavigate} />
            </Sheet>
          )}
        </>
      ) : (
        <PostList posts={posts} setPosts={setPosts} onNavigate={onNavigate} />
      )}
      {status === "ready" && page.hasMore && <div style={{ display: "flex", justifyContent: "center" }}><SmallBtn kind="outline" onClick={more}>Ver mais</SmallBtn></div>}
    </div>
  );
}
