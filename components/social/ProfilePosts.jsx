"use client";
import { useEffect, useRef, useState } from "react";
import { Message } from "../convite/ConviteUi";
import { getProfilePosts } from "../../lib/socialClient";
import { EmptyState, SmallBtn } from "./ui";
import { PostList } from "./PostList";

const EMPTY = {
  post: { self: ["Suas publicações vão aparecer aqui", "Publique fotos e histórias dos estádios que você já visitou."], other: ["Nada por aqui ainda", null] },
  checkin: { self: ["Seus check-ins vão aparecer aqui", "Quando você estiver no estádio, faça o check-in pelo botão +."], other: ["Nada por aqui ainda", null] },
};

/** As publicações (kind "post") ou os check-ins (kind "checkin") de um perfil, nas abas do perfil. */
export function ProfilePosts({ username, kind, self, onNavigate }) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState({ hasMore: false, cursor: null });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const loadingMore = useRef(false);

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
    <div style={{ padding: "12px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <Message msg={error} />
      {status === "loading" && <EmptyState title="Carregando..." />}
      {status === "ready" && posts.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <EmptyState title={title} body={body} />
          {self && <SmallBtn onClick={() => onNavigate(kind === "post" ? "post-novo" : "checkin")}>{kind === "post" ? "Nova publicação" : "Fazer check-in"}</SmallBtn>}
        </div>
      )}
      <PostList posts={posts} setPosts={setPosts} onNavigate={onNavigate} />
      {status === "ready" && page.hasMore && <div style={{ display: "flex", justifyContent: "center" }}><SmallBtn kind="outline" onClick={more}>Ver mais</SmallBtn></div>}
    </div>
  );
}
