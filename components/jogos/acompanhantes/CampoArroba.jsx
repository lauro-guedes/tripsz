"use client";
import { useRef } from "react";
import { BORDER, FONT_DISPLAY, TEXT } from "../../../lib/tokens";

/**
 * Campo de busca de amigo com o "@" FIXO na frente: a pessoa digita só o nome de usuário (ex.: ana.santos), sem o "@".
 *  - o "@" não é texto do campo: não dá pra apagar nem editar; tocar nele leva o cursor pro campo;
 *  - quem COLA "@ana.santos" não fica com dois "@" (o fixo é o único);
 *  - o usuário é sempre minúsculo, então já aparece minúsculo.
 * `value` e `onChange` trabalham SEM o "@".
 */
export function CampoArroba({ value, onChange, ariaLabel = "Buscar amigo pelo @" }) {
  const ref = useRef(null);
  const clean = (raw) => String(raw).replace(/^[\s@]+/, "").toLowerCase();
  return (
    <div onClick={() => ref.current && ref.current.focus()} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, minHeight: 48, padding: "0 14px", display: "flex", alignItems: "center", gap: 2, boxSizing: "border-box", cursor: "text" }}>
      <span data-testid="arroba-fixo" aria-hidden="true" style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: TEXT, userSelect: "none" }}>@</span>
      <input ref={ref} value={value} onChange={(e) => onChange(clean(e.target.value))} placeholder="nome.sobrenome" aria-label={ariaLabel} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="search" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 14, color: TEXT, padding: "12px 0" }} />
    </div>
  );
}
