"use client";
import { Heart, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Message, SecondaryBtn, text } from "../convite/ConviteUi";
import { saveMyProfile } from "../../lib/socialClient";
import TeamBadge from "../TeamBadge";
import { BORDER, FONT_DISPLAY, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { Sheet } from "./ui";

/** Escolha do Clube do coração: busca o time (API-Football), toca e pronto. Com um clube já escolhido, dá pra trocar ou remover. */
export function ClubePicker({ current, onClose, onSaved }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); setSearching(false); return undefined; }
    setSearching(true);
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/teams/suggest?q=${encodeURIComponent(q.trim())}`);
        const d = await r.json();
        if (alive) setResults(d.suggestions || []);
      } catch { if (alive) setResults([]); }
      if (alive) setSearching(false);
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const save = async (club) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await saveMyProfile({ heartClub: club });
    setBusy(false);
    if (!r.ok) return setMsg({ type: "error", text: r.message || "Não foi possível salvar agora." });
    onSaved();
  };

  return (
    <Sheet title="Clube do coração" onClose={onClose}>
      <p style={text(13, MUTED)}>Escolha o time que mora no seu coração. Ele aparece no seu perfil, com o escudo ao lado da sua foto.</p>
      {current && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,200,83,0.08)", borderRadius: 14, padding: "10px 12px" }}>
          <TeamBadge name={current.name} url={current.logo} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={text(11, GREEN_DARK, { fontWeight: 800 })}>SEU CLUBE DO CORAÇÃO</p>
            <p style={text(15, TEXT, { fontWeight: 700 })}>{current.name}</p>
          </div>
        </div>
      )}
      <div style={{ background: "#eef2f6", borderRadius: 14, padding: "0 14px", display: "flex", gap: 10, alignItems: "center" }}>
        <Search size={18} color={MUTED} />
        <input aria-label="Buscar clube" autoFocus value={q} onChange={(e) => setQ(e.target.value.slice(0, 60))} placeholder="Buscar clube (ex.: Palmeiras)" style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "14px 0", fontSize: 16, fontFamily: FONT_DISPLAY }} />
      </div>
      <Message msg={msg} />
      <div style={{ display: "flex", flexDirection: "column", maxHeight: 280, overflowY: "auto" }}>
        {q.trim().length < 3 && <p style={text(13, MUTED)}>Digite pelo menos 3 letras.</p>}
        {searching && <p style={text(13, MUTED)}>Buscando...</p>}
        {!searching && q.trim().length >= 3 && results.length === 0 && <p style={text(13, MUTED)}>Nenhum clube encontrado.</p>}
        {results.map((t) => (
          <div key={`${t.name}-${t.country}`} role="button" aria-label={`Escolher ${t.name}`} onClick={() => save({ name: t.name, logo: t.logo })} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: `1px solid ${BORDER}`, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
            <TeamBadge name={t.name} url={t.logo} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={text(15, TEXT, { fontWeight: 700 })}>{t.name}</p>
              {t.country && <p style={text(12, MUTED)}>{t.country}</p>}
            </div>
            <Heart size={18} color={GREEN_DARK} />
          </div>
        ))}
      </div>
      {current && <SecondaryBtn onClick={() => save(null)}>Remover clube do coração</SecondaryBtn>}
    </Sheet>
  );
}
