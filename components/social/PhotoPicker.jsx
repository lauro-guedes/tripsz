"use client";
import { Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Message } from "../convite/ConviteUi";
import { MAX_PHOTOS, VISIBILITIES, VISIBILITY_LABELS } from "../../lib/socialPostRules";
import { ACCEPT, uploadSocialImage } from "../../lib/socialMedia";
import { BORDER, FONT_DISPLAY, GREEN, MUTED } from "../../lib/tokens";
import { Chip } from "./ui";

/** Até 4 fotos do post: escolhe, reduz e envia ao Storage. `photos`: lista de endereços já enviados. */
export function PhotoPicker({ photos, setPhotos, userId }) {
  const file = useRef(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // trava imediata contra toque duplo
  const [error, setError] = useState(null);

  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f || busyRef.current) return;
    if (!userId) return setError({ type: "error", text: "Aguarde um instante e tente de novo." });
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await uploadSocialImage(userId, "post", f);
      if (r.ok) setPhotos((list) => (list.length < MAX_PHOTOS ? [...list, r.url] : list));
      else setError({ type: "error", text: r.message });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {photos.map((url, i) => (
          <div key={url} style={{ position: "relative", width: 84, height: 84 }}>
            <img src={url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
            <div role="button" aria-label={`Remover foto ${i + 1}`} onClick={() => setPhotos((l) => l.filter((x) => x !== url))} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 999, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={13} color="#fff" /></div>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <div role="button" aria-label="Adicionar foto" onClick={() => file.current && file.current.click()} style={{ width: 84, height: 84, borderRadius: 12, background: "#eef2f6", border: `1px dashed ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            <Plus size={22} color={MUTED} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, color: MUTED, margin: 0 }}>{busy ? "Enviando..." : "Foto"}</p>
          </div>
        )}
      </div>
      <input ref={file} type="file" accept={ACCEPT} onChange={pick} style={{ display: "none" }} aria-label="Escolher foto da publicação" />
      <Message msg={error} />
    </div>
  );
}

/** "Quem pode ver?": Público, Quem me segue, Só eu. */
export function VisibilityPicker({ value, onChange }) {
  return (
    <div role="group" aria-label="Quem pode ver?" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {VISIBILITIES.map((v) => <Chip key={v} on={value === v} onClick={() => onChange(v)}>{VISIBILITY_LABELS[v]}</Chip>)}
    </div>
  );
}
