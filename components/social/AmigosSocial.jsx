"use client";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Message, text } from "../convite/ConviteUi";
import { timeAgo } from "../../lib/social";
import { answerRequest, followUser, listFriends, unfollowUser } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { Avatar, EmptyState, SmallBtn, SocialShell, Tabs } from "./ui";

const EMPTY = {
  amigos: ["Nenhum amigo ainda", "Amigos são as pessoas que você segue e que seguem você de volta."],
  seguidores: ["Ninguém te segue ainda", "Quando alguém seguir você, aparece aqui."],
  seguindo: ["Você ainda não segue ninguém", "Procure amigos que também gostam de ver jogos em estádios."],
  solicitacoes: ["Nenhuma solicitação pendente", "Se o seu perfil for privado, os pedidos para te seguir aparecem aqui."],
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

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
