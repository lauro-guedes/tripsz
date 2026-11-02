"use client";
import { Camera, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CampoArroba } from "../jogos/acompanhantes/CampoArroba";
import { useAuthedUser } from "../jogos/acompanhantes/useAcompanhantes";
import { Message, PrimaryBtn, SecondaryBtn, text } from "../convite/ConviteUi";
import { cleanUsername } from "../../lib/social";
import { isNativeApp } from "../../lib/nativeApp";
import { getFeed } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { PostList } from "./PostList";
import { Avatar, EmptyState, SmallBtn, SocialShell } from "./ui";

/** Quem está no estádio agora: o círculo de cada pessoa com o estádio embaixo. */
function NowAtStadium({ people, onOpen }) {
  if (!people || people.length === 0) return null;
  return (
    <div style={{ background: "#fff", padding: "14px 16px 12px", borderBottom: `1px solid ${BORDER}` }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: "0 0 10px" }}>No estádio agora</p>
      <div style={{ display: "flex", gap: 14, overflowX: "auto" }}>
        {people.map((p) => (
          <div key={p.username} role="button" aria-label={`${p.mine ? "Você" : p.displayName} está no ${p.stadium}`} onClick={() => onOpen(p.username)} style={{ width: 64, flexShrink: 0, textAlign: "center", cursor: "pointer" }}>
            <div style={{ borderRadius: 999, padding: 2, border: `2px solid ${GREEN}`, display: "inline-block" }}><Avatar url={p.avatarUrl} name={p.displayName} size={52} /></div>
            <p style={text(12, TEXT, { fontWeight: 700, marginTop: 4 })}>{p.mine ? "Você" : p.displayName.split(" ")[0]}</p>
            <p style={{ ...text(10, MUTED), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.stadium}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Home: check-ins e publicações de quem eu sigo (e as minhas), com atalhos pra publicar e fazer check-in. */
export function FeedSocial({ onNavigate, onLogout }) {
  const me = useAuthedUser();
  const [posts, setPosts] = useState([]);
  const [now, setNow] = useState([]);
  const [page, setPage] = useState({ hasMore: false, cursor: null });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [handle, setHandle] = useState("");
  const loadingMore = useRef(false);

  const load = useCallback(async () => {
    setStatus("loading");
    const r = await getFeed();
    if (!r.ok) { setError({ type: "error", text: r.message }); return setStatus("error"); }
    setError(null);
    setPosts(r.posts);
    setNow(r.nowAtStadium || []);
    setPage({ hasMore: r.hasMore, cursor: r.nextCursor });
    setStatus("ready");
  }, []);
  useEffect(() => { load(); }, [load]);

  const more = async () => {
    if (loadingMore.current || !page.cursor) return;
    loadingMore.current = true;
    const r = await getFeed(page.cursor);
    loadingMore.current = false;
    if (!r.ok) return setError({ type: "error", text: r.message });
    setPosts((list) => [...list, ...r.posts.filter((p) => !list.some((x) => x.id === p.id))]);
    setPage({ hasMore: r.hasMore, cursor: r.nextCursor });
  };
  const target = cleanUsername(handle);

  return (
    <SocialShell onNavigate={onNavigate} onLogout={onLogout}>
      <NowAtStadium people={now} onOpen={(u) => onNavigate("usuario", u)} />
      <div style={{ background: "#fff", padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", borderBottom: `1px solid ${BORDER}` }}>
        <Avatar url={me.avatar} name={me.name} size={40} />
        <div role="button" aria-label="Nova publicação" onClick={() => onNavigate("post-novo")} style={{ flex: 1, background: "#eef2f6", borderRadius: 999, padding: "11px 16px", cursor: "pointer" }}><p style={text(14, MUTED)}>O que você viveu no futebol hoje?</p></div>
        <div role="button" aria-label="Adicionar foto à publicação" onClick={() => onNavigate("post-novo")} style={{ width: 42, height: 42, borderRadius: 999, background: "#eef2f6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Camera size={20} color={TEXT} /></div>
        <div role="button" aria-label="Fazer check-in" onClick={() => onNavigate("checkin")} style={{ width: 42, height: 42, borderRadius: 999, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><MapPin size={20} color="#fff" /></div>
      </div>
      {isNativeApp() && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto" }}>
          <SmallBtn kind="outline" onClick={() => onNavigate("buscar")}>Buscar jogos</SmallBtn>
          <SmallBtn kind="outline" onClick={() => onNavigate("calendario")}>Calendário</SmallBtn>
          <SmallBtn kind="outline" onClick={() => onNavigate("roteiros")}>Roteiros</SmallBtn>
        </div>
      )}
      <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Message msg={error} />
        {status === "loading" && <EmptyState title="Carregando o feed..." />}
        {status === "error" && <div style={{ display: "flex", justifyContent: "center" }}><SmallBtn onClick={load}>Tentar de novo</SmallBtn></div>}
        {status === "ready" && posts.length === 0 && (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={text(17, TEXT, { fontWeight: 700 })}>Seu feed está vazio</p>
            <p style={text(13, MUTED)}>Siga amigos para ver os check-ins e as publicações deles, ou faça o seu primeiro check-in ou publicação.</p>
            <PrimaryBtn onClick={() => onNavigate("checkin")}>Fazer check-in</PrimaryBtn>
            <SecondaryBtn onClick={() => onNavigate("post-novo")}>Nova publicação</SecondaryBtn>
            <p style={text(12, MUTED, { fontWeight: 700, marginTop: 4 })}>Encontrar uma pessoa pelo @</p>
            <CampoArroba value={handle} onChange={setHandle} ariaLabel="Buscar pessoa pelo @" />
            <SecondaryBtn onClick={() => target && onNavigate("usuario", target)} disabled={!target}>Ver perfil</SecondaryBtn>
          </div>
        )}
        <PostList posts={posts} setPosts={setPosts} onNavigate={onNavigate} />
        {status === "ready" && page.hasMore && <div style={{ display: "flex", justifyContent: "center" }}><SmallBtn kind="outline" onClick={more}>Ver mais</SmallBtn></div>}
      </div>
    </SocialShell>
  );
}
