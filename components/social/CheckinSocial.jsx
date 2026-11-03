"use client";
import { Check, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Message, PrimaryBtn, SecondaryBtn, text } from "../convite/ConviteUi";
import { saveDraft } from "../../lib/companionDraft";
import { registerCheckinGame } from "../../lib/checkinGame";
import { getPosition } from "../../lib/devicePosition";
import { POST_BODY_MAX } from "../../lib/socialPostRules";
import { nearbyStadiums, publishPost, setPostVisibility } from "../../lib/socialClient";
import { getVenuePhoto } from "../../lib/venuePhoto";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { kickoffLabel } from "./FeedSocial";
import { PhotoPicker, VisibilityPicker } from "./PhotoPicker";
import { EmptyState, ScreenHeader, SmallBtn, SocialShell } from "./ui";
import { useMyId } from "./useMyId";

const field = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: FONT_DISPLAY, color: TEXT, background: "#fff", outline: "none", resize: "none" };
const label = { fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: TEXT, margin: 0 };
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const VIS = { public: "Público", friends: "Seguidores", private: "Só eu" };
/** 70 -> "70 m"; 1500 -> "1,5 km" */
export const distanceLabel = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function Thumb({ name, city, size = 56 }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    getVenuePhoto(name, city).then((r) => alive && r && r.url && setUrl(r.url)).catch(() => {});
    return () => { alive = false; };
  }, [name, city]);
  return (
    <div style={{ width: size, height: size, borderRadius: 12, overflow: "hidden", background: "linear-gradient(135deg,#0f172a,#14532d)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {url ? <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <MapPin size={22} color="rgba(255,255,255,0.6)" />}
    </div>
  );
}

/** "Presença registrada": o check-in foi feito, o jogo foi pro Passaporte, e dá pra marcar quem foi junto e compartilhar no feed. */
function Concluido({ done, onNavigate }) {
  const [visibility, setVisibility] = useState(done.post.visibility);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const [error, setError] = useState(null);
  const { reg, game, stadium } = done;
  const registered = !!(reg && reg.ok);

  const share = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    setError(null);
    try {
      const r = await setPostVisibility(done.post.id, "public");
      if (r.ok) setVisibility("public");
      else setError({ type: "error", text: r.message });
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  };
  const companions = () => { saveDraft({ game: reg.game, tagged: [] }); onNavigate("acompanhantes"); };
  const note = registered
    ? "Mais uma memória no seu Football Passport."
    : game && reg && reg.reason === "limit"
      ? `O jogo não entrou no Passaporte: você atingiu o limite de ${reg.limit} jogos do plano grátis.`
      : game && reg
        ? "Não deu pra colocar o jogo no Passaporte agora. Você pode adicioná-lo depois em Adicionar jogo passado."
        : "Seu check-in está registrado.";

  return (
    <SocialShell onNavigate={onNavigate}>
      <ScreenHeader title="Presença registrada" onBack={() => onNavigate("feed")} />
      <div style={{ padding: "8px 16px 28px", display: "flex", flexDirection: "column", gap: 16, alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "10px 0" }}>
          <div style={{ width: 84, height: 84, borderRadius: 42, background: "rgba(0,200,83,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={40} color={GREEN} /></div>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, color: TEXT, margin: 0, textAlign: "center" }}>{game ? "Você está no jogo!" : "Check-in feito!"}</h2>
          <p style={{ ...text(14, MUTED), textAlign: "center" }}>{note}</p>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {game ? <p style={text(12, MUTED)}>{kickoffLabel(game.kickoff)}</p> : null}
          <p style={text(17, TEXT, { fontWeight: 800 })}>{game ? `${game.home} × ${game.away}` : stadium.name}</p>
          <p style={text(13, MUTED)}>{[game && game.competition, stadium.name].filter(Boolean).join(" · ")}</p>
          <p style={text(13, GREEN_DARK, { fontWeight: 700 })}>📍 Seu check-in está registrado</p>
          <span style={{ alignSelf: "flex-start", background: "rgba(0,200,83,0.12)", color: GREEN_DARK, borderRadius: 999, padding: "5px 12px", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12 }}>{VIS[visibility] || "Público"} · Presença atual</span>
        </div>
        <Message msg={error} />
        {registered && <PrimaryBtn onClick={companions}>Quem foi com você?</PrimaryBtn>}
        {visibility === "private" ? (
          registered ? <SecondaryBtn onClick={share} disabled={sharing}>{sharing ? "Compartilhando..." : "Compartilhar no feed"}</SecondaryBtn> : <PrimaryBtn onClick={share} disabled={sharing}>{sharing ? "Compartilhando..." : "Compartilhar no feed"}</PrimaryBtn>
        ) : registered ? (
          <SecondaryBtn onClick={() => onNavigate("feed")}>Ver no feed</SecondaryBtn>
        ) : (
          <PrimaryBtn onClick={() => onNavigate("feed")}>Ver no feed</PrimaryBtn>
        )}
        <p role="button" aria-label="Voltar ao Início" onClick={() => onNavigate("feed")} style={{ ...text(14, GREEN_DARK, { fontWeight: 700 }), textAlign: "center", cursor: "pointer" }}>Voltar ao Início</p>
      </div>
    </SocialShell>
  );
}

/**
 * Check-in: só vale DENTRO do estádio (o servidor confere o GPS de novo ao confirmar). Escolhe o estádio e o jogo de agora, confirma a
 * presença e o jogo vai pro Passaporte; depois dá pra marcar quem foi junto ("Quem foi com você?") e compartilhar no feed.
 */
export function CheckinSocial({ onNavigate, onLogout }) {
  const userId = useMyId();
  const [phase, setPhase] = useState("locating"); // locating | denied | error | ready
  const [message, setMessage] = useState("");
  const [pos, setPos] = useState(null);
  const [stadiums, setStadiums] = useState([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [changing, setChanging] = useState(false);
  const [fixtureId, setFixtureId] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState([]);
  const [visibility, setVisibility] = useState("public");
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false); // trava imediata contra toque duplo
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

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
  const game = chosen && chosen.games.find((g) => g.fixtureId === fixtureId) || null;
  const q = query.trim().toLowerCase();
  const shown = stadiums.filter((s) => !q || `${s.name} ${s.city || ""} ${s.games.map((g) => `${g.home} ${g.away}`).join(" ")}`.toLowerCase().includes(q));
  const choose = (s) => { setPicked(s.key); setFixtureId(null); setConfirmed(false); setChanging(false); };

  const publish = async () => {
    if (!chosen || !confirmed || publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);
    setError(null);
    try {
      const r = await publishPost({ kind: "checkin", lat: pos.lat, lon: pos.lon, accuracy: pos.accuracy, stadiumKey: chosen.key, fixtureId, body, photos, visibility });
      if (!r.ok) return setError({ type: "error", text: r.message });
      const reg = game ? await registerCheckinGame({ game, stadium: chosen }) : null; // o jogo vai pro Passaporte
      setDone({ post: r.post, reg, game, stadium: chosen });
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  };

  if (done) return <Concluido done={done} onNavigate={onNavigate} />;

  const d = new Date();
  return (
    <SocialShell onNavigate={onNavigate} onLogout={onLogout}>
      <ScreenHeader title="Fazer check-in" onBack={() => onNavigate("central")} />
      <div style={{ padding: "0 16px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        <span style={{ alignSelf: "flex-start", background: "rgba(0,200,83,0.12)", color: GREEN_DARK, borderRadius: 999, padding: "6px 12px", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 12 }}>PRESENÇA ATUAL · {String(d.getDate()).padStart(2, "0")} {MONTHS[d.getMonth()]} {d.getFullYear()}</span>
        {phase === "locating" && <EmptyState title="Procurando estádios perto de você..." body="Permita o acesso à localização se o aparelho pedir." />}
        {(phase === "denied" || phase === "error") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <EmptyState title={phase === "denied" ? "Sem localização" : "Não deu pra conferir o local"} body={message} />
            <SmallBtn onClick={locate}>Tentar de novo</SmallBtn>
          </div>
        )}
        {phase === "ready" && stadiums.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <EmptyState title="Nenhum estádio por perto" body="O check-in só vale dentro do estádio. Quando estiver lá, tente de novo." />
            <SmallBtn onClick={locate}>Tentar de novo</SmallBtn>
          </div>
        )}
        {phase === "ready" && stadiums.length > 0 && (
          <>
            <div style={{ background: "#eef2f6", borderRadius: 14, padding: "0 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <Search size={18} color={MUTED} />
              <input aria-label="Buscar jogo ou estádio" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jogo ou estádio..." style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "14px 0", fontSize: 14, fontFamily: FONT_DISPLAY }} />
            </div>
            {chosen && !changing ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <p style={label}>Estádio selecionado</p>
                  <p role="button" aria-label="Alterar estádio" onClick={() => setChanging(true)} style={{ ...text(14, GREEN_DARK, { fontWeight: 700 }), cursor: "pointer" }}>Alterar</p>
                </div>
                <div style={{ background: "rgba(0,200,83,0.08)", border: `1px solid ${GREEN}`, borderRadius: 16, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                  <Thumb name={chosen.name} city={chosen.city} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={text(16, TEXT, { fontWeight: 800 })}>{chosen.name}</p>
                    <p style={text(13, MUTED)}>{[chosen.city, chosen.country].filter(Boolean).join(", ")} · {distanceLabel(chosen.distance)}</p>
                  </div>
                  <Check size={22} color={GREEN_DARK} />
                </div>
              </>
            ) : (
              <>
                <p style={label}>Estádios próximos</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {shown.map((s) => {
                    const on = picked === s.key;
                    return (
                      <div key={s.key} role="button" aria-label={`Check-in em ${s.name}`} aria-pressed={on} aria-disabled={!s.atStadium} onClick={() => s.atStadium && choose(s)} style={{ background: on ? "rgba(0,200,83,0.08)" : "#fff", border: `1px solid ${on ? GREEN : BORDER}`, borderRadius: 14, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", cursor: s.atStadium ? "pointer" : "default", opacity: s.atStadium ? 1 : 0.55 }}>
                        <MapPin size={22} color={s.atStadium ? GREEN : MUTED} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={text(15, TEXT, { fontWeight: 700 })}>{s.name}</p>
                          <p style={text(12, MUTED)}>{[s.city, s.country].filter(Boolean).join(", ")} · {distanceLabel(s.distance)}</p>
                        </div>
                        <p style={text(11, s.atStadium ? GREEN_DARK : MUTED, { fontWeight: 700 })}>{s.atStadium ? "Você está aqui" : "Longe do estádio"}</p>
                      </div>
                    );
                  })}
                  {shown.length === 0 && <p style={text(13, MUTED)}>Nada com esse nome por perto.</p>}
                </div>
                {!stadiums.some((s) => s.atStadium) && <p style={text(13, MUTED)}>Você ainda não está dentro de um estádio. O check-in só vale lá dentro.</p>}
              </>
            )}
            {chosen && !changing && (
              <>
                <p style={label}>Selecione o jogo</p>
                {chosen.games.length === 0 && <p style={text(13, MUTED)}>Nenhum jogo acontecendo agora neste estádio. Você ainda pode fazer o check-in sem jogo.</p>}
                {chosen.games.map((g) => {
                  const on = fixtureId === g.fixtureId;
                  return (
                    <div key={g.fixtureId} role="button" aria-label={`Jogo ${g.home} × ${g.away}`} aria-pressed={on} onClick={() => setFixtureId(g.fixtureId)} style={{ background: "#fff", border: `1px solid ${on ? GREEN : BORDER}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 6, cursor: "pointer" }}>
                      <p style={text(12, MUTED)}>{kickoffLabel(g.kickoff)}</p>
                      <p style={text(17, TEXT, { fontWeight: 800 })}>{g.home} × {g.away}</p>
                      <p style={text(13, MUTED)}>{[g.competition, chosen.name].filter(Boolean).join(" · ")}</p>
                      {g.presentCount > 0 && <p style={text(13, GREEN_DARK, { fontWeight: 700 })}>📍 {plural(g.presentCount, "torcedor presente", "torcedores presentes")}</p>}
                      {on && <span style={{ alignSelf: "flex-start", background: "rgba(0,200,83,0.12)", color: GREEN_DARK, borderRadius: 999, padding: "5px 12px", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12 }}>{g.home} × {g.away} · Selecionado</span>}
                    </div>
                  );
                })}
                {chosen.games.length > 0 && <p role="button" aria-label="Sem jogo" aria-pressed={fixtureId === null} onClick={() => setFixtureId(null)} style={{ ...text(13, fixtureId === null ? GREEN_DARK : MUTED, { fontWeight: 700 }), cursor: "pointer" }}>{fixtureId === null ? "✓ " : ""}Sem jogo (só o estádio)</p>}
                <div role="checkbox" aria-checked={confirmed} aria-label="Estou no estádio" onClick={() => setConfirmed(!confirmed)} style={{ background: "#fff", border: `1px solid ${confirmed ? GREEN : BORDER}`, borderRadius: 16, padding: 16, display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                  <div style={{ flex: 1 }}>
                    <p style={text(16, TEXT, { fontWeight: 800 })}>Estou no estádio</p>
                    <p style={text(13, MUTED)}>{game ? "Confirmo minha presença nesta partida." : "Confirmo minha presença neste estádio."}</p>
                    <p style={{ ...text(12, MUTED), marginTop: 8 }}>Jogos de outras datas devem ser adicionados como registro histórico.</p>
                  </div>
                  <div style={{ width: 26, height: 26, borderRadius: 13, border: `2px solid ${confirmed ? GREEN : "#cbd5e1"}`, background: confirmed ? GREEN : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{confirmed && <Check size={16} color="#fff" />}</div>
                </div>
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
                <PrimaryBtn onClick={publish} disabled={!confirmed || publishing}>{publishing ? "Confirmando..." : "Confirmar presença"}</PrimaryBtn>
              </>
            )}
          </>
        )}
      </div>
    </SocialShell>
  );
}
