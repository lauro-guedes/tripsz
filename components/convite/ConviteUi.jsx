"use client";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { BORDER, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";

export const GREEN_TINT = "#e8faef";
export const AMBER_BG = "#fffbeb";
export const SLATE_BG = "#f1f5f9";

export const text = (size, color = MUTED, extra) => ({ fontFamily: FONT_DISPLAY, fontSize: size, lineHeight: 1.45, color, margin: 0, ...extra });

/** Aviso colorido (amarelo = expirou; cinza = informação). */
export function Notice({ tone = "slate", icon, title, children }) {
  return (
    <div style={{ background: tone === "amber" ? AMBER_BG : SLATE_BG, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      {icon}
      <p style={text(20, TEXT, { fontWeight: 700 })}>{title}</p>
      <p style={text(13)}>{children}</p>
    </div>
  );
}

export function Card({ children }) {
  return <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>;
}

export function Field({ label, value, onChange, type = "text", autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={text(10, MUTED, { fontFamily: FONT_MONO, lineHeight: 1.4, textTransform: "uppercase" })}>{label}</span>
      <span style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, minHeight: 48, padding: "0 14px", display: "flex", alignItems: "center", gap: 10, boxSizing: "border-box" }}>
        <input value={value} onChange={(e) => onChange(e.target.value)} type={isPass && show ? "text" : type} autoComplete={autoComplete} placeholder={placeholder} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, padding: "12px 0" }} />
        {isPass && (
          <span role="button" aria-label={show ? "Esconder senha" : "Mostrar senha"} onClick={() => setShow((s) => !s)} style={{ cursor: "pointer", display: "flex" }}>
            {show ? <EyeOff size={18} color={MUTED} /> : <Eye size={18} color={MUTED} />}
          </span>
        )}
      </span>
    </label>
  );
}

export function PrimaryBtn({ children, onClick, disabled }) {
  return (
    <div role="button" aria-disabled={disabled} onClick={disabled ? undefined : onClick} style={{ background: GREEN, border: `1px solid ${GREEN}`, borderRadius: 12, height: 48, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", boxSizing: "border-box", opacity: disabled ? 0.6 : 1, cursor: disabled ? "default" : "pointer" }}>
      <p style={text(13, TEXT, { fontWeight: 700, lineHeight: "normal" })}>{children}</p>
    </div>
  );
}

export function SecondaryBtn({ children, onClick, icon, disabled }) {
  return (
    <div role="button" aria-disabled={disabled} onClick={disabled ? undefined : onClick} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, height: 48, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "0 16px", boxSizing: "border-box", opacity: disabled ? 0.6 : 1, cursor: disabled ? "default" : "pointer" }}>
      {icon}
      <p style={text(13, TEXT, { fontWeight: 700, lineHeight: "normal" })}>{children}</p>
    </div>
  );
}

export function LinkBtn({ children, onClick }) {
  return (
    <p role="button" onClick={onClick} style={text(13, GREEN_DARK, { fontWeight: 600, textAlign: "center", cursor: "pointer", lineHeight: "normal" })}>
      {children}
    </p>
  );
}

export const smallText = (size = 11, color = MUTED) => text(size, color);

/** Mensagem de erro ou de informação logo acima do botão. */
export function Message({ msg }) {
  if (!msg) return null;
  const error = msg.type === "error";
  return (
    <p role={error ? "alert" : "status"} style={text(12, error ? "#b91c1c" : GREEN_DARK, { fontWeight: 600 })}>
      {msg.text}
    </p>
  );
}

/** Botão do Google: depois do clique mostra "Conectando ao Google..." (a ida ao Google leva alguns segundos). Se der erro, a tela libera `disabled` e o botão volta. */
export function GoogleButton({ onClick, disabled }) {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!disabled) setLoading(false);
  }, [disabled]);
  const go = () => {
    if (loading) return;
    setLoading(true);
    onClick();
  };
  return (
    <SecondaryBtn onClick={go} disabled={disabled || loading} icon={loading ? <Spinner size={18} /> : <Icon name="google" size={18} />}>
      {loading ? "Conectando ao Google..." : "Entrar com Google"}
    </SecondaryBtn>
  );
}

export function OrDivider() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ background: BORDER, height: 1, flex: 1 }} />
      <p style={text(10, MUTED, { fontFamily: FONT_MONO, lineHeight: "normal", textTransform: "uppercase" })}>ou com e-mail</p>
      <div style={{ background: BORDER, height: 1, flex: 1 }} />
    </div>
  );
}
