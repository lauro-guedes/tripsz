"use client";
import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Message, text } from "../convite/ConviteUi";
import { ACCEPT, uploadSocialImage } from "../../lib/socialMedia";
import { getVenuePhoto } from "../../lib/venuePhoto";
import { BORDER, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";

const DEFAULTS = [{ name: "San Siro", city: "Milão" }, { name: "Maracanã", city: "Rio de Janeiro" }, { name: "Camp Nou", city: "Barcelona" }, { name: "Allianz Arena", city: "Munique" }];

/** Os estádios que a pessoa já visitou primeiro; o resto, estádios famosos. No máximo 4, sem repetir. */
export function suggestionList(visited = []) {
  const seen = new Set();
  const out = [];
  for (const s of [...visited.map((n) => ({ name: n, city: "" })), ...DEFAULTS]) {
    const k = s.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length === 4) break;
  }
  return out;
}

/** Foto de capa: sugestões (fotos de estádio) ou foto da própria pessoa. */
export function CoverPicker({ value, onChange, userId, visited = [] }) {
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const file = useRef(null);
  const key = visited.join("|");

  useEffect(() => {
    let alive = true;
    Promise.all(suggestionList(visited).map((s) => getVenuePhoto(s.name, s.city).then((r) => (r && r.url ? { name: s.name, url: r.url } : null)).catch(() => null))).then((list) => alive && setPhotos(list.filter(Boolean)));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f || busy) return;
    if (!userId) return setError({ type: "error", text: "Aguarde um instante e tente de novo." });
    setBusy(true);
    setError(null);
    const r = await uploadSocialImage(userId, "cover", f);
    setBusy(false);
    if (r.ok) onChange(r.url);
    else setError({ type: "error", text: r.message });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ position: "relative", height: 150, borderRadius: 16, overflow: "hidden", background: "linear-gradient(135deg,#0f172a,#14532d)", border: value ? `2px solid ${GREEN}` : `1px solid ${BORDER}` }}>
        {value && <img src={value} alt="Capa atual" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        {value && <p style={{ position: "absolute", left: 12, top: 10, margin: 0, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 11, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>Atual selecionada</p>}
      </div>
      {photos.length > 0 && (
        <div>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: "0 0 8px" }}>Sugestões de estádios</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {photos.map((p) => (
              <div key={p.name} role="button" aria-label={`Usar foto do ${p.name}`} aria-pressed={value === p.url} onClick={() => onChange(p.url)} style={{ height: 64, borderRadius: 10, overflow: "hidden", cursor: "pointer", border: `2px solid ${value === p.url ? GREEN : "transparent"}` }}>
                <img src={p.url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div role="button" aria-label="Enviar foto personalizada" onClick={() => file.current && file.current.click()} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, display: "flex", gap: 12, alignItems: "center", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
        <Upload size={20} color={GREEN} />
        <div>
          <p style={text(14, TEXT, { fontWeight: 700 })}>{busy ? "Enviando..." : "Enviar foto personalizada"}</p>
          <p style={text(12, MUTED)}>JPG, PNG ou WebP, tamanho ideal de 16:9</p>
        </div>
      </div>
      <input ref={file} type="file" accept={ACCEPT} onChange={pick} style={{ display: "none" }} aria-label="Escolher foto de capa" />
      <Message msg={error} />
    </div>
  );
}
