"use client";
import { useRef, useState } from "react";
import { Message } from "../convite/ConviteUi";
import { likePost, unlikePost } from "../../lib/socialClient";
import { Comentarios } from "./Comentarios";
import { PostCard } from "./PostCard";
import { PostMenu } from "./PostMenu";

/**
 * A lista de publicações (feed e perfil): curtir (na hora, desfaz se falhar), comentários, menu (apagar/denunciar) e abrir o perfil.
 * `posts`/`setPosts` ficam com quem usa a lista.
 */
export function PostList({ posts, setPosts, onNavigate }) {
  const [commentsFor, setCommentsFor] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [error, setError] = useState(null);
  const liking = useRef(new Set()); // trava imediata: um toque de cada vez por post

  const patch = (id, changes) => setPosts((list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  const toggleLike = async (post) => {
    if (liking.current.has(post.id)) return;
    liking.current.add(post.id);
    setError(null);
    const want = !post.likedByMe;
    patch(post.id, { likedByMe: want, likes: Math.max(0, post.likes + (want ? 1 : -1)) });
    try {
      const r = want ? await likePost(post.id) : await unlikePost(post.id);
      if (r.ok) patch(post.id, { likedByMe: r.likedByMe, likes: r.likes });
      else {
        patch(post.id, { likedByMe: post.likedByMe, likes: post.likes });
        setError({ type: "error", text: r.message });
      }
    } finally {
      liking.current.delete(post.id);
    }
  };

  return (
    <>
      <Message msg={error} />
      {posts.map((p) => (
        <PostCard key={p.id} post={p} onLike={toggleLike} onComments={setCommentsFor} onMenu={setMenuFor} onOpenProfile={(u) => onNavigate("usuario", u)} />
      ))}
      {commentsFor && <Comentarios post={commentsFor} onClose={() => setCommentsFor(null)} onCount={(n) => patch(commentsFor.id, { comments: n })} />}
      {menuFor && <PostMenu post={menuFor} onClose={() => setMenuFor(null)} onDeleted={(id) => { setPosts((list) => list.filter((p) => p.id !== id)); setMenuFor(null); }} />}
    </>
  );
}
