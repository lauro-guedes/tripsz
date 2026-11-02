"use client";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Message, PrimaryBtn, text } from "../convite/ConviteUi";
import { getPosition } from "../../lib/devicePosition";
import { POST_BODY_MAX } from "../../lib/socialPostRules";
import { nearbyStadiums, publishPost } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { PhotoPicker, VisibilityPicker } from "./PhotoPicker";
import { Chip, EmptyState, SmallBtn, SocialShell } from "./ui";
import { useMyId } from "./useMyId";

const field = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: FONT_DISPLAY, color: TEXT, background: "#fff", outline: "none", resize: "none" };
const label = { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 };
/** 70 -> "70 m"; 1500 -> "1,5 km" */
export const distanceLabel = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
const hhmm = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""; };

/**
 * Check-in: só vale DENTRO do estádio (o servidor confere o GPS de novo na hora de publicar).
 * Pega a localização, lista os estádios por perto (só o que está a até 700 m dá pra escolher), jogo de agora, foto e texto.
 */
export function CheckinSocial({ onNavigate, onLogout }) {
  const userId = useMyId();
  const [phase, setPhase] = useState("locating"); // locating | denied | error | ready
  const [message, setMessage] = useState("");
  const [pos, setPos] = useState(null);
  const [stadiums, setStadiums] = useState([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [fixtureId, setFixtureId] = useState(null);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState([]);
  const [visibility, setVisibility] = useState("public");
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false); // trava imediata contra toque duplo
  const [error, setError] = useState(null);

  const locate = useCallback(async () => {
    setPhase("locating");
    setError(null);
    setPicked(null);
    const p = await getPosition();
    if (!p) { setMessage("Não conseguimos pegar a sua localização. Ative a localização do aparelho e tente de novo."); return setPhase("denied"); }
    setPos(p);
    const r = await nearbyStadiums(p);
    if (!r.ok) { setMessage(r.message); return setPhase("error"); }
    setStadiums(r.stadiums);
    const here = r.stadiums.filter((s) => s.atStadium);
    if (here.length === 1) setPicked(here[0].key);
    setPhase("ready");
  }, []);
  useEffect(() => { locate(); }, [locate]);

  const chosen = stadiums.find((s) => s.key === picked) || null;
  const q = query.trim().toLowerCase();
  const shown = stadiums.filter((s) => !q || `${s.name} ${s.city || ""}`.toLowerCase().includes(q));

  const publish = async () => {
    if (!chosen || publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);
    setError(null);
    try {
      const r = await publishPost({ kind: "checkin", lat: pos.lat, lon: pos.lon, accuracy: pos.accuracy, stadiumKey: chosen.key, fixtureId, body, photos, visibility });
      if (r.ok) onNavigate("feed");
      else setError({ type: "error", text: r.message });
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  };

  return (
    <SocialShell onNavigate={onNavigate} onLogout={onLogout}>
      <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div role="button" aria-label="Voltar" onClick={() => onNavigate("feed")} style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ArrowLeft size={20} color={TEXT} /></div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: TEXT, margin: 0 }}>Check-in</h1>
        </div>
        {phase === "locating" && <EmptyState title="Procurando estádios perto de você..." body="Permita o acesso à localização se o aparelho pedir." />}
        {(phase === "denied" || phase === "error") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <EmptyState title={phase === "denied" ? "Sem localização" : "Não deu pra conferir o local"} body={message} />
            <SmallBtn onClick={locate}>Tentar de novo</SmallBtn>
          </div>
        )}
        {phase === "ready" && (
          <>
            {stadiums.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <EmptyState title="Nenhum estádio por perto" body="O check-in só vale dentro do estádio. Quando estiver lá, tente de novo." />
                <SmallBtn onClick={locate}>Tentar de novo</SmallBtn>
              </div>
            ) : (
              <>
                <div style={{ background: "#eef2f6", borderRadius: 12, padding: "0 14px", display: "flex", gap: 10, alignItems: "center" }}>
                  <Search size={18} color={MUTED} />
                  <input aria-label="Buscar estádio" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar estádio..." style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "13px 0", fontSize: 14, fontFamily: FONT_DISPLAY }} />
                </div>
                <p style={label}>Estádios próximos</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {shown.map((s) => {
                    const on = picked === s.key;
                    return (
                      <div key={s.key} role="button" aria-label={`Check-in em ${s.name}`} aria-pressed={on} aria-disabled={!s.atStadium} onClick={() => s.atStadium && (setPicked(s.key), setFixtureId(null))} style={{ background: on ? "rgba(0,200,83,0.08)" : "#fff", border: `1px solid ${on ? GREEN : BORDER}`, borderRadius: 14, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", cursor: s.atStadium ? "pointer" : "default", opacity: s.atStadium ? 1 : 0.55 }}>
                        <MapPin size={22} color={s.atStadium ? GREEN : MUTED} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={text(15, TEXT, { fontWeight: 700 })}>{s.name}</p>
                          <p style={text(12, MUTED)}>{[s.city, s.country].filter(Boolean).join(", ")} · {distanceLabel(s.distance)}</p>
                        </div>
                        <p style={text(11, s.atStadium ? GREEN_DARK : MUTED, { fontWeight: 700 })}>{s.atStadium ? "Você está aqui" : "Longe do estádio"}</p>
                      </div>
                    );
                  })}
                  {shown.length === 0 && <p style={text(13, MUTED)}>Nenhum estádio com esse nome por perto.</p>}
                </div>
                {!stadiums.some((s) => s.atStadium) && <p style={text(13, MUTED)}>Você ainda não está dentro de um estádio. O check-in só vale lá dentro.</p>}
              </>
            )}
            {chosen && (
              <>
                {chosen.games.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={label}>Jogo agora</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Chip on={fixtureId === null} onClick={() => setFixtureId(null)}>Sem jogo</Chip>
                      {chosen.games.map((g) => <Chip key={g.fixtureId} on={fixtureId === g.fixtureId} onClick={() => setFixtureId(g.fixtureId)}>{`${g.home} × ${g.away} · ${hhmm(g.kickoff)}`}</Chip>)}
                    </div>
                  </div>
                )}
                <PhotoPicker photos={photos} setPhotos={setPhotos} userId={userId} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <textarea aria-label="Texto do check-in" value={body} onChange={(e) => setBody(e.target.value.slice(0, POST_BODY_MAX))} rows={3} placeholder="Escreva algo sobre este check-in..." style={field} />
                  <p style={{ ...text(12, MUTED), textAlign: "right" }}>{body.length}/{POST_BODY_MAX}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={label}>Quem pode ver?</p>
                  <VisibilityPicker value={visibility} onChange={setVisibility} />
                </div>
                <Message msg={error} />
                <PrimaryBtn onClick={publish} disabled={publishing}>{publishing ? "Fazendo check-in..." : "Fazer check-in"}</PrimaryBtn>
              </>
            )}
          </>
        )}
      </div>
    </SocialShell>
  );
}
