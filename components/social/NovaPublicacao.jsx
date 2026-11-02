"use client";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Message, PrimaryBtn, SecondaryBtn, text } from "../convite/ConviteUi";
import { POST_BODY_MAX } from "../../lib/socialPostRules";
import { getVisited, publishPost } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { PhotoPicker, VisibilityPicker } from "./PhotoPicker";
import { Chip, EmptyState, Sheet, SmallBtn, SocialShell } from "./ui";
import { useMyId } from "./useMyId";

const field = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: FONT_DISPLAY, color: TEXT, background: "#fff", outline: "none", resize: "none" };
const label = { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 };
const dmy = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

/**
 * Nova Publicação: fotos e texto sobre um estádio que a pessoa JÁ visitou (os do Passaporte), com o jogo (opcional)
 * e quem pode ver. Quem ainda não tem estádio registrado é levado a registrar um jogo.
 */
export function NovaPublicacao({ onNavigate, onLogout }) {
  const userId = useMyId();
  const [visited, setVisited] = useState(null);
  const [loadError, setLoadError] = useState(null); // falha ao carregar NÃO é "sem estádios": mostra o erro
  const [stadium, setStadium] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState([]);
  const [visibility, setVisibility] = useState("public");
  const [choosing, setChoosing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false); // trava imediata contra toque duplo
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setVisited(null);
    const r = await getVisited();
    if (!r.ok) return setLoadError(r.message);
    setVisited(r.stadiums);
    if (r.stadiums.length) setStadium(r.stadiums[0].name);
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = (visited || []).find((s) => s.name === stadium) || null;
  const canPublish = !!current && (body.trim().length > 0 || photos.length > 0) && !publishing;
  const publish = async () => {
    if (!canPublish || publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);
    setError(null);
    try {
      const r = await publishPost({ kind: "post", body, photos, stadium: current.name, gameId, visibility });
      if (r.ok) onNavigate("feed");
      else setError({ type: "error", text: r.message });
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  };

  return (
    <SocialShell onNavigate={onNavigate} onLogout={onLogout}>
      <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div role="button" aria-label="Fechar" onClick={() => onNavigate("feed")} style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={20} color={TEXT} /></div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: TEXT, margin: 0, flex: 1 }}>Nova publicação</h1>
        </div>
        {visited === null && !loadError && <EmptyState title="Carregando..." />}
        {loadError && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <EmptyState title="Não foi possível carregar seus estádios" body={loadError} />
            <SmallBtn onClick={load}>Tentar de novo</SmallBtn>
          </div>
        )}
        {visited && visited.length === 0 && (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={text(16, TEXT, { fontWeight: 700 })}>Você ainda não tem estádios no Passaporte</p>
            <p style={text(13, MUTED)}>As publicações são sobre estádios que você já visitou. Registre um jogo para poder publicar, ou faça check-in quando estiver no estádio.</p>
            <PrimaryBtn onClick={() => onNavigate("registrar-jogo")}>Registrar um jogo</PrimaryBtn>
            <SecondaryBtn onClick={() => onNavigate("checkin")}>Fazer check-in</SecondaryBtn>
          </div>
        )}
        {current && (
          <>
            <PhotoPicker photos={photos} setPhotos={setPhotos} userId={userId} />
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ ...text(14, TEXT, { fontWeight: 600 }), flex: 1 }}>📍 {[current.name, current.city, current.country].filter(Boolean).join(" — ")}</p>
              <p role="button" aria-label="Trocar estádio" onClick={() => setChoosing(true)} style={{ ...text(13, GREEN, { fontWeight: 700 }), cursor: "pointer" }}>Trocar</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={label}>Jogo (opcional)</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Chip on={gameId === null} onClick={() => setGameId(null)}>Sem jogo</Chip>
                {current.games.map((g) => <Chip key={g.id} on={gameId === g.id} onClick={() => setGameId(g.id)}>{`${g.home} × ${g.away}${g.date ? ` · ${dmy(g.date)}` : ""}`}</Chip>)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <textarea aria-label="Texto da publicação" value={body} onChange={(e) => setBody(e.target.value.slice(0, POST_BODY_MAX))} rows={5} placeholder="Conte como foi..." style={field} />
              <p style={{ ...text(12, MUTED), textAlign: "right" }}>{body.length}/{POST_BODY_MAX}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={label}>Quem pode ver?</p>
              <VisibilityPicker value={visibility} onChange={setVisibility} />
            </div>
            <Message msg={error} />
            <PrimaryBtn onClick={publish} disabled={!canPublish}>{publishing ? "Publicando..." : "Publicar"}</PrimaryBtn>
          </>
        )}
      </div>
      {choosing && (
        <Sheet title="Escolher estádio" onClose={() => setChoosing(false)}>
          {visited.map((s) => (
            <div key={s.name} role="button" aria-label={`Escolher ${s.name}`} aria-pressed={s.name === stadium} onClick={() => { setStadium(s.name); setGameId(null); setChoosing(false); }} style={{ border: `1px solid ${s.name === stadium ? GREEN : BORDER}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
              <p style={text(15, TEXT, { fontWeight: 700 })}>{s.name}</p>
              <p style={text(12, MUTED)}>{[s.city, s.country].filter(Boolean).join(", ")} · {s.visits} {s.visits === 1 ? "visita" : "visitas"}</p>
            </div>
          ))}
        </Sheet>
      )}
    </SocialShell>
  );
}
