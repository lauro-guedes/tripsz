"use client";
import { authFetch } from "../../lib/authFetch";
import { normalizeUsername, usernameError } from "../../lib/username";
import { FONT_DISPLAY, FONT_MONO, GREEN, MUTED } from "../../lib/tokens";
import { useEffect, useRef, useState } from "react";

/** Campo de @usuário do Meu Perfil: confere formato e disponibilidade enquanto digita. */
export function UsernameEditField({ value, original, onChange, onValidity, fieldStyle }) {
  const [check, setCheck] = useState({ state: "idle" });
  const seq = useRef(0);
  const u = normalizeUsername(value);

  useEffect(() => {
    if (!u || u === original) {
      setCheck({ state: "idle" });
      return;
    }
    const formatError = usernameError(u);
    if (formatError) {
      setCheck({ state: "invalid", message: formatError });
      return;
    }
    setCheck({ state: "checking" });
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/username/check?u=${encodeURIComponent(u)}`);
        const data = await res.json();
        if (mine !== seq.current) return;
        setCheck(data.available ? { state: "ok" } : { state: "taken", message: data.reason || "Esse @ já está em uso.", suggestion: data.suggestion });
      } catch {
        if (mine === seq.current) setCheck({ state: "ok" });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [u, original]);

  // blocked = não dá para salvar agora
  useEffect(() => {
    onValidity?.(check.state === "invalid" || check.state === "taken" || check.state === "checking" || (!u && !!original));
  }, [check.state, u, original]);

  const msg = { fontFamily: FONT_DISPLAY, fontSize: 12, margin: 0 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nome de usuário</p>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: 0, bottom: 0, display: "flex", alignItems: "center", color: MUTED, fontSize: 14 }}>@</span>
        <input
          value={value}
          onChange={(e) => onChange(normalizeUsername(e.target.value).slice(0, 20))}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{ ...fieldStyle, paddingLeft: 32, ...(check.state === "invalid" || check.state === "taken" ? { borderColor: "#dc2626" } : {}) }}
        />
      </div>
      {check.state === "checking" && <p style={{ ...msg, color: MUTED }}>Verificando disponibilidade...</p>}
      {check.state === "ok" && <p style={{ ...msg, color: GREEN }}>@{u} está disponível.</p>}
      {(check.state === "invalid" || check.state === "taken") && <p style={{ ...msg, color: "#dc2626" }}>{check.message}</p>}
      {check.state === "taken" && check.suggestion && (
        <p onClick={() => onChange(check.suggestion)} style={{ ...msg, color: GREEN, fontWeight: 700, cursor: "pointer" }}>Usar @{check.suggestion}</p>
      )}
      {check.state === "idle" && <p style={{ ...msg, color: MUTED }}>Seu link público e as marcações de amigos usam esse @. Pode trocar quando quiser.</p>}
    </div>
  );
}
