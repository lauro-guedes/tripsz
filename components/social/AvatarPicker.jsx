"use client";
import { Camera, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Message } from "../convite/ConviteUi";
import { initialsOf } from "../../lib/social";
import { ACCEPT, uploadSocialImage } from "../../lib/socialMedia";
import { BORDER, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { Avatar } from "./ui";

/** Foto de perfil: tirar agora, escolher da galeria ou ficar com as iniciais (monograma). */
export function AvatarPicker({ value, name, coverUrl, onChange, userId }) {
  const camera = useRef(null);
  const gallery = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f || busy) return;
    if (!userId) return setError({ type: "error", text: "Aguarde um instante e tente de novo." });
    setBusy(true);
    setError(null);
    const r = await uploadSocialImage(userId, "avatar", f);
    setBusy(false);
    if (r.ok) onChange(r.url);
    else setError({ type: "error", text: r.message });
  };
  const btn = (label, icon, ref) => (
    <div role="button" aria-label={label} onClick={() => ref.current && ref.current.click()} style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "13px 10px", display: "flex", justifyContent: "center", gap: 8, alignItems: "center", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
      {icon}
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{label}</p>
    </div>
  );
  const mono = initialsOf(name);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ position: "relative", height: 150, borderRadius: 16, background: "linear-gradient(135deg,#0f172a,#14532d)", overflow: "visible" }}>
        {coverUrl && <img src={coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} />}
        <div style={{ position: "absolute", left: "50%", bottom: -44, transform: "translateX(-50%)" }}>
          <Avatar url={value} name={name} size={96} ring />
          <div style={{ position: "absolute", right: 0, bottom: 2, width: 30, height: 30, borderRadius: 999, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}><Camera size={15} color="#fff" /></div>
        </div>
      </div>
      <div style={{ height: 36 }} />
      <div style={{ display: "flex", gap: 10 }}>
        {btn(busy ? "Enviando..." : "Tirar foto", <Camera size={18} color={TEXT} />, camera)}
        {btn("Galeria", <Upload size={18} color={TEXT} />, gallery)}
      </div>
      <input ref={camera} type="file" accept={ACCEPT} capture="user" onChange={pick} style={{ display: "none" }} aria-label="Tirar foto de perfil" />
      <input ref={gallery} type="file" accept={ACCEPT} onChange={pick} style={{ display: "none" }} aria-label="Escolher foto de perfil da galeria" />
      <div>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: "0 0 8px" }}>Ou escolha um monograma</p>
        <div role="button" aria-label={`Usar monograma ${mono}`} aria-pressed={!value} onClick={() => onChange(null)} style={{ width: 52, height: 52, borderRadius: 999, border: `2px solid ${!value ? GREEN : BORDER}`, background: !value ? "rgba(0,200,83,0.1)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: TEXT, margin: 0 }}>{mono}</p>
        </div>
      </div>
      <Message msg={error} />
    </div>
  );
}
