"use client";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Message, text } from "../convite/ConviteUi";
import { timeAgo } from "../../lib/social";
import { answerRequest, followUser, listFriends, searchPeople, suggestedPeople, unfollowUser } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { Avatar, EmptyState, SmallBtn, SocialShell, Tabs } from "./ui";

const EMPTY = {
  amigos: ["Nenhum amigo ainda", "Amigos são as pessoas que você segue e que seguem você de volta."],
  seguidores: ["Ninguém te segue ainda", "Quando alguém seguir você, aparece aqui."],
  seguindo: ["Você ainda não segue ninguém", "Procure amigos que também gostam de ver jogos em estádios."],
  solicitacoes: ["Nenhuma solicitação pendente", "Se o seu perfil for privado, os pedidos para te seguir aparecem aqui."],
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Buscar pessoas por nome ou @ e as sugestões ("amigos em comum", "visitou o mesmo estádio"). Seguir direto da lista. */
function Descobrir({ onOpen }) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState(null); // null = carregando
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const seq = useRef(0);
  const searching = query.trim().replace(/^@/, "").length >= 2;

  useEffect(() => {
    const mine = ++seq.current;
    setPeople(null);
    const t = setTimeout(async () => {
      const r = searching ? await searchPeople(query) : await suggestedPeople();
      if (mine !== seq.current) return; // resposta de uma busca antiga
      if (!r.ok) { setError({ type: "error", text: r.message }); return setPeople([]); }
      setError(null);
      setPeople(r.people);
    }, searching ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, searching]);

  const toggle = async (p) => {
    if (busy) return;
    setBusy(p.username);
    try {
      const r = p.iFollow || p.requested ? await unfollowUser(p.username) : await followUser(p.username);
      if (!r.ok) return setError({ type: "error", text: r.message });
      const state = r.relation && r.relation.state;
      setError(null);
      setPeople((list) => (list || []).map((x) => (x.username === p.username ? { ...x, iFollow: state === "following", requested: state === "requested" } : x)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ padding: "14px 16px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={text(14, TEXT, { fontWeight: 700 })}>Adicionar amigo</p>
      <div style={{ background: "#eef2f6", borderRadius: 14, padding: "0 14px", display: "flex", gap: 10, alignItems: "center" }}>
        <Search size={18} color={MUTED} />
        <input aria-label="Buscar pessoas por nome ou @" value={query} onChange={(e) => setQuery(e.target.value.slice(0, 40))} placeholder="Buscar por nome ou @" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="search" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", padding: "14px 0", fontSize: 16, fontFamily: FONT_DISPLAY }} />
      </div>
      <Message msg={error} />
      {!searching && people && people.length > 0 && <p style={text(13, MUTED, { fontWeight: 700 })}>Sugestões para você</p>}
      {people === null && <p style={text(13, MUTED)}>{searching ? "Buscando..." : "Carregando sugestões..."}</p>}
      {people && people.length === 0 && !error && (searching ? <EmptyState title="Ninguém encontrado" body="Confira o nome ou o @ e tente de novo." /> : null)}
      {(people || []).map((p) => (
        <div key={p.username} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
          <div role="button" aria-label={`Abrir perfil de @${p.username}`} onClick={() => onOpen(p.username)} style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0, cursor: "pointer" }}>
            <Avatar url={p.avatarUrl} name={p.displayName} size={44} />
            <div style={{ minWidth: 0 }}>
              <p style={text(15, TEXT, { fontWeight: 700 })}>{p.displayName}</p>
              <p style={text(12, MUTED)}>@{p.username}{p.isPrivate ? " · perfil privado" : ""}</p>
              {p.reason && <p style={text(12, GREEN_DARK, { fontWeight: 600 })}>{p.reason}</p>}
            </div>
          </div>
          {p.iFollow ? (
            <SmallBtn kind="outline" onClick={() => toggle(p)} disabled={busy === p.username} label={`Deixar de seguir @${p.username}`}>Seguindo</SmallBtn>
          ) : p.requested ? (
            <SmallBtn kind="outline" onClick={() => toggle(p)} disabled={busy === p.username} label={`Cancelar pedido para @${p.username}`}>Solicitado</SmallBtn>
          ) : (
            <SmallBtn onClick={() => toggle(p)} disabled={busy === p.username} label={`Seguir @${p.username}`}>Seguir</SmallBtn>
          )}
        </div>
      ))}
    </div>
  );
}

/** Amigos (seguir = ser amigo): Amigos (se seguem), Seguidores, Seguindo e Solicitações (perfil privado). */
export function AmigosSocial({ onNavigate, onLogout }) {
  const [tab, setTab] = useState("amigos");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ amigos: 0, seguidores: 0, seguindo: 0, solicitacoes: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // @ da linha em andamento
  const busyRef = useRef(false); // trava imediata contra toque duplo

  const load = useCallback(async (which, offset = 0) => {
    if (offset === 0) setStatus("loading");
    const r = await listFriends(which, offset);
    if (!r.ok) { setStatus("error"); return setError({ type: "error", text: r.message }); }
    setError(null);
    setCounts(r.counts);
    setHasMore(r.hasMore);
    setRows((prev) => (offset === 0 ? r.rows : [...prev, ...r.rows]));
    setStatus("ready");
  }, []);
  useEffect(() => { load(tab); }, [tab, load]);

  const act = async (username, fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(username);
    try {
      const r = await fn();
      if (!r.ok) setError({ type: "error", text: r.message });
      else await load(tab);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };
  const open = (username) => onNavigate("usuario", username);

  return (
    <SocialShell onNavigate={onNavigate} onLogout={onLogout}>
      <div style={{ background: "#fff", padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <div role="button" aria-label="Voltar ao perfil" onClick={() => onNavigate("perfil")} style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ArrowLeft size={20} color={TEXT} /></div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, color: TEXT, margin: 0 }}>Amigos</h1>
      </div>
      <Descobrir onOpen={open} />
      <Tabs label="Listas de amigos" value={tab} onChange={setTab} tabs={[{ id: "amigos", label: "Amigos", count: counts.amigos }, { id: "seguidores", label: "Seguidores", count: counts.seguidores }, { id: "seguindo", label: "Seguindo", count: counts.seguindo }, { id: "solicitacoes", label: "Solicitações", count: counts.solicitacoes }]} />
      <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        <Message msg={error} />
        {status === "loading" && <EmptyState title="Carregando..." />}
        {status === "ready" && rows.length === 0 && <EmptyState title={EMPTY[tab][0]} body={EMPTY[tab][1]} />}
        {status === "ready" && tab === "solicitacoes" && rows.length > 0 && <p style={text(13, MUTED, { fontWeight: 700 })}>Solicitações pendentes</p>}
        {rows.map((r) => (
          <div key={r.username} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
            <div role="button" aria-label={`Abrir perfil de @${r.username}`} onClick={() => open(r.username)} style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0, cursor: "pointer" }}>
              <Avatar url={r.avatarUrl} name={r.displayName} size={48} />
              <div style={{ minWidth: 0 }}>
                <p style={text(15, TEXT, { fontWeight: 700 })}>{r.displayName} <span style={{ fontWeight: 500, color: MUTED, fontSize: 12 }}>@{r.username}</span></p>
                {r.stats && <p style={text(12, GREEN_DARK, { fontWeight: 600 })}>{plural(r.stats.stadiums, "estádio", "estádios")} · {plural(r.stats.countries, "país", "países")}</p>}
                {r.lastGame && r.lastGame.stadium && <p style={text(11, MUTED)}>Último jogo: {r.lastGame.stadium}{r.lastGame.date ? `, ${timeAgo(r.lastGame.date)}` : ""}</p>}
                {tab === "solicitacoes" && <p style={text(12, MUTED)}>{plural(r.common || 0, "amigo", "amigos")} em comum</p>}
              </div>
            </div>
            {tab === "solicitacoes" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <SmallBtn onClick={() => act(r.username, () => answerRequest(r.username, "accept"))} disabled={busy === r.username} label={`Aceitar @${r.username}`}>Aceitar</SmallBtn>
                <SmallBtn kind="outline" onClick={() => act(r.username, () => answerRequest(r.username, "decline"))} disabled={busy === r.username} label={`Recusar @${r.username}`}>Recusar</SmallBtn>
              </div>
            ) : r.iFollow ? (
              <SmallBtn kind="outline" onClick={() => act(r.username, () => unfollowUser(r.username))} disabled={busy === r.username} label={`Deixar de seguir @${r.username}`}>Seguindo</SmallBtn>
            ) : (
              <SmallBtn onClick={() => act(r.username, () => followUser(r.username))} disabled={busy === r.username} label={`Seguir @${r.username}`}>Seguir</SmallBtn>
            )}
          </div>
        ))}
        {hasMore && <SmallBtn kind="outline" onClick={() => load(tab, rows.length)}>Ver mais</SmallBtn>}
      </div>
    </SocialShell>
  );
}
