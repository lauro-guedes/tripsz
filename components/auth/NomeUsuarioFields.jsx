"use client";
import { normalizeUsername, suggestUsername, usernameError } from "../../lib/username";
import { FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { useEffect, useRef, useState } from "react";

/**
 * Nome, sobrenome e @usuário do cadastro. O @ é sugerido a partir do nome (nome.sobrenome)
 * enquanto a pessoa não o editar, e a disponibilidade é conferida no servidor.
 * onChange(campo, valor) recebe "firstName", "lastName" ou "username".
 */
export function NomeUsuarioFields({ firstName, lastName, username, onChange, fieldStyle, showErrors, onValidity }) {
  const label = { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 };
  const errText = { fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 };
  const [edited, setEdited] = useState(() => !!username && username !== suggestUsername(firstName, lastName));
  const [check, setCheck] = useState({ state: "idle" }); // idle | checking | ok | taken | invalid
  const seq = useRef(0);

  const firstOk = (firstName || "").trim().length > 0;
  const lastOk = (lastName || "").trim().length > 0;

  // Sugere o @ enquanto a pessoa não mexeu nele.
  useEffect(() => {
    if (!edited) onChange("username", suggestUsername(firstName, lastName));
  }, [firstName, lastName, edited]);

  // Confere formato e disponibilidade (com pequeno atraso para não consultar a cada tecla).
  useEffect(() => {
    const u = normalizeUsername(username);
    if (!u) {
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
        const q = new URLSearchParams({ u, first: firstName || "", last: lastName || "" });
        const res = await fetch(`/api/username/check?${q}`);
        const data = await res.json();
        if (mine !== seq.current) return;
        if (data.available) setCheck({ state: "ok" });
        else setCheck({ state: "taken", message: data.reason || "Esse @ já está em uso.", suggestion: data.suggestion });
      } catch {
        if (mine === seq.current) setCheck({ state: "ok" }); // sem rede: o servidor confere de novo ao criar a conta
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const usernameValid = check.state === "ok";
  useEffect(() => {
    onValidity?.({ firstOk, lastOk, usernameValid, checking: check.state === "checking" });
  }, [firstOk, lastOk, usernameValid, check.state]);

  const border = (bad) => (bad ? { ...fieldStyle, borderColor: "#dc2626" } : fieldStyle);

  return (
    <>
      <div style={{ display: "flex", gap: 12, width: "100%", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 180px", minWidth: 0 }}>
          <p style={label}>Nome</p>
          <input value={firstName || ""} onChange={(e) => onChange("firstName", e.target.value)} placeholder="Seu nome" autoComplete="given-name" style={border(showErrors && !firstOk)} />
          {showErrors && !firstOk && <p style={errText}>Digite seu nome.</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 180px", minWidth: 0 }}>
          <p style={label}>Sobrenome</p>
          <input value={lastName || ""} onChange={(e) => onChange("lastName", e.target.value)} placeholder="Seu sobrenome" autoComplete="family-name" style={border(showErrors && !lastOk)} />
          {showErrors && !lastOk && <p style={errText}>Digite seu sobrenome.</p>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <p style={label}>Nome de usuário</p>
        <div style={{ position: "relative", width: "100%" }}>
          <span style={{ position: "absolute", left: 16, top: 0, height: 44, display: "flex", alignItems: "center", color: MUTED, fontSize: 16 }}>@</span>
          <input
            value={username || ""}
            onChange={(e) => {
              setEdited(true);
              onChange("username", normalizeUsername(e.target.value).slice(0, 20));
            }}
            placeholder="nome.sobrenome"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{ ...border(check.state === "invalid" || check.state === "taken"), paddingLeft: 34 }}
          />
        </div>
        {check.state === "checking" && <p style={{ ...errText, color: MUTED }}>Verificando disponibilidade...</p>}
        {check.state === "ok" && <p style={{ ...errText, color: GREEN }}>@{normalizeUsername(username)} está disponível.</p>}
        {(check.state === "invalid" || check.state === "taken") && <p style={errText}>{check.message}</p>}
        {check.state === "taken" && check.suggestion && (
          <p
            onClick={() => {
              setEdited(true);
              onChange("username", check.suggestion);
            }}
            style={{ ...errText, color: GREEN, cursor: "pointer", fontWeight: 700 }}
          >
            Usar @{check.suggestion}
          </p>
        )}
        {check.state === "idle" && showErrors && <p style={errText}>Escolha um nome de usuário.</p>}
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>É como seus amigos vão te encontrar. Letras, números, ponto e underline.</p>
      </div>
    </>
  );
}
