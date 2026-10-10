"use client";
import { supabaseBrowser } from "../../lib/supabase";
import { BG, BORDER, FONT_BODY, FONT_DISPLAY, GREEN, GREEN_BUTTON2, MUTED, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";
import { useIsMobile } from "../ui/useIsMobile";
import { ResetPasswordModal } from "./ResetPasswordModal";
import { Eye, EyeOff, X } from "lucide-react";
import { useState } from "react";

export function LoginModal({ onClose, onCreateAccount }) {
  const isMobile = useIsMobile();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const fieldStyle = (invalid) => ({
    width: "100%",
    background: "#fff",
    border: `1px solid ${invalid ? "#dc2626" : BORDER}`,
    borderRadius: 12,
    height: 56,
    padding: "0 16px",
    fontFamily: FONT_BODY,
    fontSize: 16,
    color: TEXT,
    outline: "none",
  });

  const handleLogin = async () => {
    setLoginError(null);
    if (!loginEmail || !loginPassword) {
      setLoginError("Preencha e-mail e senha para continuar.");
      return;
    }
    setLoginLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error) {
        setLoginError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
        return;
      }
      onClose();
      // Não navega daqui de propósito: o listener de autenticação global
      // (em App()) já detecta esse login e decide pra onde ir, conforme
      // a intenção salva (Meus Roteiros, questionário etc).
    } catch (e) {
      setLoginError("Não foi possível conectar com o servidor de contas. Tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setLoginError(error.message);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#0f172a", opacity: 0.56 }} />
      <div style={{ position: "relative", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, width: isMobile ? "calc(100% - 32px)" : 400, maxWidth: 400, display: "flex", flexDirection: "column", gap: 20, boxShadow: "0px 12px 16px rgba(15,23,42,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Acesso</p>
          <div onClick={onClose} style={{ background: BG, border: `1px solid ${BORDER}`, width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} color={TEXT} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          <div onClick={handleGoogleLogin} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: "100%", cursor: "pointer" }}>
            <Icon name="google" size={20} color={TEXT} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Entrar com Google</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", width: "100%" }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>ou</p>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>E-mail</p>
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="nome@exemplo.com" style={fieldStyle(false)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Senha</p>
            <div style={{ position: "relative" }}>
              <input
                type={showLoginPassword ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                placeholder="••••••••"
                style={{ ...fieldStyle(false), paddingRight: 48 }}
              />
              <div onClick={() => setShowLoginPassword((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </div>
            </div>
          </div>
          {loginError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0, width: "100%" }}>{loginError}</p>}
          <p onClick={() => setShowResetModal(true)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#dc2626", margin: 0, cursor: "pointer" }}>Esqueci minha senha</p>
          {onCreateAccount && (
            <div style={{ display: "flex", gap: 8 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Não tem conta?</p>
              <p onClick={onCreateAccount} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0, cursor: "pointer" }}>Criar conta</p>
            </div>
          )}
        </div>

        <div onClick={loginLoading ? undefined : handleLogin} style={{ background: GREEN_BUTTON2, opacity: loginLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: "100%", cursor: loginLoading ? "default" : "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{loginLoading ? "Entrando..." : "Entrar"}</p>
        </div>
      </div>
      {showResetModal && <ResetPasswordModal onClose={() => setShowResetModal(false)} onBackToLogin={() => setShowResetModal(false)} />}
    </div>
  );
}
