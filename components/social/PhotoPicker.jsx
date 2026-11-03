"use client";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Message } from "../convite/ConviteUi";
import { MAX_PHOTOS, VISIBILITIES, VISIBILITY_LABELS } from "../../lib/socialPostRules";
import { ACCEPT, uploadSocialImage } from "../../lib/socialMedia";
import { BORDER, FONT_DISPLAY, GREEN, MUTED } from "../../lib/tokens";
import { Chip } from "./ui";

/** Até 4 fotos do post: aparecem NA HORA (prévia local) enquanto reduz e envia ao Storage, várias de uma vez. `photos`: lista de endereços já enviados. */
export function PhotoPicker({ photos, setPhotos, userId, onBusy }) {
  const file = useRef(null);
  const [pending, setPending] = useState([]); // [{ id, preview }] enviando agora
  const previews = useRef(new Map()); // endereço enviado -> prévia local (evita piscar quando a foto "troca" pro endereço final)
  const slots = useRef(MAX_PHOTOS);
  const [error, setError] = useState(null);
  slots.current = MAX_PHOTOS - photos.length - pending.length;
  useEffect(() => { if (onBusy) onBusy(pending.length > 0); }, [pending.length, onBusy]);

  useEffect(() => () => { previews.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const pick = async (e) => {
    const chosen = [...(e.target.files || [])];
    e.target.value = "";
    if (chosen.length === 0) return;
    if (!userId) return setError({ type: "error", text: "Aguarde um instante e tente de novo." });
    const take = chosen.slice(0, Math.max(0, slots.current));
    if (take.length === 0) return;
    setError(null);
    const items = take.map((f) => ({ id: `${Date.now()}-${Math.random()}`, f, preview: URL.createObjectURL(f) }));
    setPending((l) => [...l, ...items.map(({ id, preview }) => ({ id, preview }))]);
    await Promise.all(items.map(async ({ id, f, preview }) => {
      const r = await uploadSocialImage(userId, "post", f);
      if (r.ok) {
        previews.current.set(r.url, preview);
        setPhotos((list) => (list.length < MAX_PHOTOS ? [...list, r.url] : list));
      } else {
        URL.revokeObjectURL(preview);
        setError({ type: "error", text: r.message });
      }
      setPending((l) => l.filter((x) => x.id !== id));
    }));
  };
  const total = photos.length + pending.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {photos.map((url, i) => (
          <div key={url} style={{ position: "relative", width: 84, height: 84 }}>
            <img src={previews.current.get(url) || url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
            <div role="button" aria-label={`Remover foto ${i + 1}`} onClick={() => setPhotos((l) => l.filter((x) => x !== url))} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 999, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={13} color="#fff" /></div>
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.id} aria-label="Enviando foto" style={{ position: "relative", width: 84, height: 84 }}>
            <img src={p.preview} alt="Foto sendo enviada" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12, opacity: 0.55 }} />
            <p style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 10, color: "#fff", margin: 0, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>Enviando...</p>
          </div>
        ))}
        {total < MAX_PHOTOS && (
          <div role="button" aria-label="Adicionar foto" onClick={() => file.current && file.current.click()} style={{ width: 84, height: 84, borderRadius: 12, background: "#eef2f6", border: `1px dashed ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer" }}>
            <Plus size={22} color={MUTED} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, color: MUTED, margin: 0 }}>Foto</p>
          </div>
        )}
      </div>
      <input ref={file} type="file" multiple accept={ACCEPT} onChange={pick} style={{ display: "none" }} aria-label="Escolher foto da publicação" />
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
