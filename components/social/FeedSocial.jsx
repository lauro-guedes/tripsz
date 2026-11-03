"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CampoArroba } from "../jogos/acompanhantes/CampoArroba";
import { useAuthedUser } from "../jogos/acompanhantes/useAcompanhantes";
import { Message, PrimaryBtn, SecondaryBtn, text } from "../convite/ConviteUi";
import { cleanUsername } from "../../lib/social";
import { isNativeApp } from "../../lib/nativeApp";
import { getFeed, getTodayCheckins } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { PostList } from "./PostList";
import { Avatar, BrandHeader, EmptyState, SmallBtn, SocialShell } from "./ui";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "Segunda-feira, 02 de novembro de 2026" */
export function todayLabel(now = new Date()) {
  const s = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** "02 nov · 20:45" */
export function kickoffLabel(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** "Mais check-ins hoje": os jogos com mais gente fazendo check-in (contagens, nada de quem). */
function TodayCheckins({ games, onSeeAll }) {
  if (!games || games.length === 0) return null;
  return (
    <div style={{ padding: "0 16px 6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "4px 0 10px" }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: TEXT, margin: 0 }}>Mais check-ins hoje</p>
        <p role="button" aria-label="Ver jogos" onClick={onSeeAll} style={{ ...text(13, GREEN_DARK, { fontWeight: 700 }), cursor: "pointer" }}>Ver jogos</p>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
        {games.map((g) => (
          <div key={g.fixtureId} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14, minWidth: 168, maxWidth: 190, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <p style={text(11, MUTED)}>{kickoffLabel(g.kickoff)}</p>
            <p style={text(15, TEXT, { fontWeight: 800 })}>{g.home} × {g.away}</p>
            <p style={text(12, MUTED)}>{[g.competition, g.stadium].filter(Boolean).join(" · ")}</p>
            <p style={text(12, GREEN_DARK, { fontWeight: 700 })}>📍 {g.count} {g.count === 1 ? "check-in" : "check-ins"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Início: os posts e check-ins (Todos ou só de quem eu sigo), com os jogos de hoje com mais check-ins no topo. */
export function FeedSocial({ onNavigate, onLogout, onCreateTrip }) {
  const me = useAuthedUser();
  const [scope, setScope] = useState("todos");
  const [posts, setPosts] = useState([]);
  const [today, setToday] = useState([]);
  const [page, setPage] = useState({ hasMore: false, cursor: null });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [handle, setHandle] = useState("");
  const loadingMore = useRef(false);

  const load = useCallback(async (which) => {
    setStatus("loading");
    const r = await getFeed(null, which);
    if (!r.ok) { setError({ type: "error", text: r.message }); return setStatus("error"); }
    setError(null);
    setPosts(r.posts);
    setPage({ hasMore: r.hasMore, cursor: r.nextCursor });
    setStatus("ready");
  }, []);
  useEffect(() => { load(scope); }, [scope, load]);
  useEffect(() => { let alive = true; getTodayCheckins().then((r) => alive && r.ok && setToday(r.games)); return () => { alive = false; }; }, []);

  const more = async () => {
    if (loadingMore.current || !page.cursor) return;
    loadingMore.current = true;
    const r = await getFeed(page.cursor, scope);
    loadingMore.current = false;
    if (!r.ok) return setError({ type: "error", text: r.message });
    setPosts((list) => [...list, ...r.posts.filter((p) => !list.some((x) => x.id === p.id))]);
    setPage({ hasMore: r.hasMore, cursor: r.nextCursor });
  };
  const target = cleanUsername(handle);

  return (
    <SocialShell onNavigate={onNavigate} onLogout={onLogout}>
      {isNativeApp() && <BrandHeader onBell={() => onNavigate("notificacoes")} />}
      <div style={{ padding: "14px 16px 8px" }}>
        <p style={text(13, MUTED)}>{todayLabel()}</p>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, color: TEXT, margin: "4px 0 0" }}>O futebol acontece aqui.</h1>
      </div>
      {onCreateTrip && (
        <div style={{ padding: "2px 16px 8px" }}>
          <div style={{ borderRadius: 14, background: "linear-gradient(135deg,#0f172a,#14532d)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: "#fff", margin: 0, lineHeight: 1.2 }}>Encontre o melhor roteiro de futebol para sua viagem.</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.35 }}>Escolha países, datas e times. Nossa plataforma cruza os jogos disponíveis e entrega os jogos possíveis e a melhor sequência de cidades para sua viagem.</p>
            <div role="button" aria-label="Montar meu roteiro" onClick={onCreateTrip} style={{ background: GREEN, borderRadius: 10, padding: "9px 14px", textAlign: "center", cursor: "pointer", marginTop: 2 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>Montar meu roteiro</p>
            </div>
          </div>
        </div>
      )}
      <TodayCheckins games={today} onSeeAll={() => onNavigate("buscar")} />
      <div style={{ padding: "8px 16px" }}>
        <div role="tablist" aria-label="Quem aparece no Início" style={{ display: "flex", background: "#eef2f6", borderRadius: 12, padding: 4, gap: 4 }}>
          {[["todos", "Todos"], ["seguindo", "Seguindo"]].map(([id, label]) => (
            <div key={id} role="tab" aria-selected={scope === id} onClick={() => setScope(id)} style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 9, cursor: "pointer", background: scope === id ? "#fff" : "transparent" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: scope === id ? GREEN_DARK : MUTED, margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "4px 16px 8px", display: "flex", gap: 10, alignItems: "center" }}>
        <Avatar url={me.avatar} name={me.name} size={40} />
        <div role="button" aria-label="Nova publicação" onClick={() => onNavigate("post-novo")} style={{ flex: 1, background: "#eef2f6", borderRadius: 999, padding: "12px 16px", cursor: "pointer" }}><p style={text(14, MUTED)}>O que você viveu no futebol hoje?</p></div>
      </div>
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Message msg={error} />
        {status === "loading" && <EmptyState title="Carregando o Início..." />}
        {status === "error" && <div style={{ display: "flex", justifyContent: "center" }}><SmallBtn onClick={() => load(scope)}>Tentar de novo</SmallBtn></div>}
        {status === "ready" && posts.length === 0 && scope === "seguindo" && (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={text(17, TEXT, { fontWeight: 700 })}>Nada de quem você segue ainda</p>
            <p style={text(13, MUTED)}>Quando as pessoas que você segue publicarem ou fizerem check-in, aparece aqui. Veja o que está rolando com todos.</p>
            <PrimaryBtn onClick={() => setScope("todos")}>Ver todos</PrimaryBtn>
            <p style={text(12, MUTED, { fontWeight: 700, marginTop: 4 })}>Encontrar uma pessoa pelo @</p>
            <CampoArroba value={handle} onChange={setHandle} ariaLabel="Buscar pessoa pelo @" />
            <SecondaryBtn onClick={() => target && onNavigate("usuario", target)} disabled={!target}>Ver perfil</SecondaryBtn>
          </div>
        )}
        {status === "ready" && posts.length === 0 && scope === "todos" && (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={text(17, TEXT, { fontWeight: 700 })}>Ainda não há publicações</p>
            <p style={text(13, MUTED)}>Seja o primeiro: faça um check-in no estádio ou compartilhe uma história.</p>
            <PrimaryBtn onClick={() => onNavigate("central")}>Registrar agora</PrimaryBtn>
          </div>
        )}
        <PostList posts={posts} setPosts={setPosts} onNavigate={onNavigate} />
        {status === "ready" && page.hasMore && <div style={{ display: "flex", justifyContent: "center" }}><SmallBtn kind="outline" onClick={more}>Ver mais</SmallBtn></div>}
      </div>
    </SocialShell>
  );
}
