"use client";
import { supabaseBrowser } from "../../lib/supabase";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, GREEN, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import { useIsMobile } from "../ui/useIsMobile";
import { X } from "lucide-react";
import { useState } from "react";

export function ResetPasswordModal({ onClose, onBackToLogin }) {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Digite seu e-mail.");
      return;
    }
    setSending(true);
    try {
      const supabase = supabaseBrowser();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (e) {
      // Por segurança, não confirmamos se o e-mail existe ou não na
      // base — sempre mostra sucesso, igual qualquer app sério faz.
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#0f172a", opacity: 0.56 }} />
      <div style={{ position: "relative", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, width: isMobile ? "calc(100% - 32px)" : 400, maxWidth: 400, display: "flex", flexDirection: "column", gap: 20, boxShadow: "0px 12px 16px rgba(15,23,42,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Redefinir senha</p>
          <div onClick={onClose} style={{ background: BG, border: `1px solid ${BORDER}`, width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} color={TEXT} />
          </div>
        </div>

        {sent ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, lineHeight: 1.5, color: BODY, margin: 0 }}>
              Se <strong>{email}</strong> estiver cadastrado, enviamos um link de redefinição de senha pra ele.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: MUTED, flexShrink: 0 }} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Verifique sua caixa de entrada e spam.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, lineHeight: "20px", color: MUTED, margin: 0, width: "100%" }}>
              Insira o e-mail cadastrado para receber um link de redefinição de senha.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>E-mail</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="nome@exemplo.com"
                style={{ width: "100%", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, height: 44, padding: "0 16px", fontFamily: FONT_BODY, fontSize: 16, color: TEXT, outline: "none" }}
              />
            </div>
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: MUTED, flexShrink: 0 }} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Verifique sua caixa de entrada e spam.</p>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", width: "100%" }}>
          {!sent && (
            <div onClick={sending ? undefined : handleSend} style={{ background: GREEN_BUTTON, opacity: sending ? 0.6 : 1, width: "100%", padding: "14px 24px", borderRadius: 12, textAlign: "center", cursor: sending ? "default" : "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{sending ? "Enviando..." : "Enviar link"}</p>
            </div>
          )}
          <p onClick={onBackToLogin} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, textAlign: "center", width: "100%", margin: 0, cursor: "pointer" }}>Voltar para login</p>
        </div>
      </div>
    </div>
  );
}
