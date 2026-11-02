"use client";
import { MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Message, SecondaryBtn, text } from "../convite/ConviteUi";
import { getPosition } from "../../lib/devicePosition";
import { getStadiums } from "../../lib/socialClient";
import { getVenuePhoto } from "../../lib/venuePhoto";
import { BORDER, FONT_DISPLAY, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { EmptyState, SocialShell } from "./ui";

/** 70 -> "70 m"; 4200 -> "4,2 km" */
export const distLabel = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

function Photo({ name, city }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    getVenuePhoto(name, city).then((r) => alive && r && r.url && setUrl(r.url)).catch(() => {});
    return () => { alive = false; };
  }, [name, city]);
  return (
    <div style={{ height: 150, borderRadius: 12, overflow: "hidden", background: "linear-gradient(135deg,#0f172a,#14532d)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {url ? <img src={url} alt={name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <MapPin size={34} color="rgba(255,255,255,0.5)" />}
    </div>
  );
}

const TABS = [["todos", "Todos"], ["visitados", "Visitados"], ["nao_visitados", "Não visitados"]];

/** Estádios: descobrir arquibancadas (as do calendário do app), com distância, o que já visitei, check-ins de hoje e amigos que já foram. */
export function EstadiosSocial({ onNavigate, onLogout, openPage = (path) => window.location.assign(path) }) {
  const [scope, setScope] = useState("todos");
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState(undefined); // undefined = ainda pedindo; null = sem localização
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const seq = useRef(0);

  useEffect(() => { let alive = true; getPosition().then((p) => alive && setPos(p || null)); return () => { alive = false; }; }, []);
  useEffect(() => {
    if (pos === undefined) return undefined;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const r = await getStadiums({ scope, q: query.trim(), lat: pos ? pos.lat : undefined, lon: pos ? pos.lon : undefined });
      if (mine !== seq.current) return; // resposta de uma busca antiga
      if (!r.ok) { setError({ type: "error", text: r.message }); return setData({ stadiums: [], total: 0 }); }
      setError(null);
      setData(r);
    }, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [scope, query, pos]);

  const open = (slug) => openPage(`/estadios/${slug}`); // a página pública do estádio
  const where = data && data.nearCity ? `Perto de ${data.nearCity} · Mais próximos` : pos ? "Mais próximos" : "Mais check-ins hoje";

  return (
    <SocialShell onNavigate={onNavigate} onLogout={onLogout}>
      <div style={{ padding: "18px 16px 8px" }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, color: TEXT, margin: 0 }}>Encontre sua próxima arquibancada.</h1>
      </div>
      <div style={{ padding: "6px 16px" }}>
        <div style={{ background: "#eef2f6", borderRadius: 14, padding: "0 14px", display: "flex", gap: 10, alignItems: "center" }}>
          <Search size={18} color={MUTED} />
          <input aria-label="Buscar estádio ou cidade" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar estádio ou cidade..." style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "14px 0", fontSize: 14, fontFamily: FONT_DISPLAY }} />
        </div>
      </div>
      <div style={{ padding: "6px 16px" }}>
        <div role="tablist" aria-label="Quais estádios" style={{ display: "flex", background: "#eef2f6", borderRadius: 12, padding: 4, gap: 4 }}>
          {TABS.map(([id, label]) => (
            <div key={id} role="tab" aria-selected={scope === id} onClick={() => setScope(id)} style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 9, cursor: "pointer", background: scope === id ? "#fff" : "transparent" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: scope === id ? GREEN_DARK : MUTED, margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "6px 16px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={text(12, MUTED)}>{where}</p>
        <Message msg={error} />
        {!data && <EmptyState title="Procurando estádios..." />}
        {data && data.stadiums.length === 0 && !error && <EmptyState title={scope === "visitados" ? "Você ainda não visitou nenhum estádio daqui" : "Nenhum estádio encontrado"} body={query ? "Tente outro nome ou cidade." : null} />}
        {(data ? data.stadiums : []).map((s) => (
          <div key={s.slug} role="button" aria-label={`Abrir ${s.name}`} onClick={() => open(s.slug)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, padding: 12, display: "flex", flexDirection: "column", gap: 10, cursor: "pointer" }}>
            <Photo name={s.name} city={s.city} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, color: TEXT, margin: 0 }}>{s.name}</p>
              <span style={{ background: s.visited ? "rgba(0,200,83,0.14)" : "#eef2f6", color: s.visited ? GREEN_DARK : MUTED, borderRadius: 999, padding: "5px 12px", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>{s.visited ? "Visitado" : "Não visitado"}</span>
            </div>
            <p style={text(13, MUTED)}>{[[s.city, s.country].filter(Boolean).join(", "), s.distance != null ? distLabel(s.distance) : null].filter(Boolean).join(" · ")}</p>
            {(s.checkinsToday > 0 || s.friends > 0) && (
              <p style={text(13, GREEN_DARK, { fontWeight: 600 })}>
                {s.visited
                  ? [s.checkinsToday > 0 && `${s.checkinsToday} ${s.checkinsToday === 1 ? "check-in hoje" : "check-ins hoje"}`, s.friends > 0 && `${s.friends} ${s.friends === 1 ? "amigo" : "amigos"}`].filter(Boolean).join(" · ")
                  : [s.checkinsToday > 0 && `${s.checkinsToday} ${s.checkinsToday === 1 ? "check-in hoje" : "check-ins hoje"}`, s.friends > 0 && `${s.friends} ${s.friends === 1 ? "amigo já visitou" : "amigos já visitaram"}`].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        ))}
        <SecondaryBtn onClick={() => openPage("/estadios")}>Explorar todos os estádios</SecondaryBtn>
      </div>
    </SocialShell>
  );
}
