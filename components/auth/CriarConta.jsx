"use client";
import { supabaseBrowser } from "../../lib/supabase";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, GREEN, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";
import { Wordmark } from "../ui/Wordmark";
import { useIsMobile } from "../ui/useIsMobile";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/* --- Modal de login independente — funciona sobre QUALQUER tela (landing,
   questionário etc), sem precisar trocar a tela de fundo pra "account". --- */
export function CriteriaDot({ ok, label }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
      <div style={{ width: 6, height: 6, borderRadius: 3, background: ok ? GREEN : BORDER, flexShrink: 0 }} />
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: ok ? GREEN : MUTED, margin: 0 }}>{label}</p>
    </div>
  );
}

export function CriarConta({ onDone, onLogin, onHome }) {
  const isMobile = useIsMobile();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatWhatsapp = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.replace(/^(\d*)/, "($1");
    if (digits.length <= 7) return digits.replace(/^(\d{2})(\d*)/, "($1) $2");
    return digits.replace(/^(\d{2})(\d{5})(\d*)/, "($1) $2-$3");
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passChecks = { upper: /[A-Z]/.test(password), lower: /[a-z]/.test(password), len: password.length >= 8 };
  const passwordValid = passChecks.upper && passChecks.lower && passChecks.len;
  const confirmValid = passwordConfirm === password && password.length > 0;
  const nameValid = name.trim().length > 1;
  const whatsappDigits = whatsapp.replace(/\D/g, "");
  const whatsappValid = whatsappDigits.length === 10 || whatsappDigits.length === 11;

  const handleGoogleSignup = async () => {
    setError(null);
    const supabase = supabaseBrowser();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) setError(oauthError.message);
  };

  const handleCreateAccount = async () => {
    setError(null);
    if (!nameValid) return setError("Preencha seu nome completo.");
    if (!emailValid) return setError("Digite um e-mail válido.");
    if (!whatsappValid) return setError("Digite um WhatsApp válido, com DDD.");
    if (!passwordValid) return setError("A senha precisa atender aos critérios abaixo.");
    if (!confirmValid) return setError("As senhas não coincidem.");

    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, whatsapp } },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      onDone();
    } catch {
      setError("Não foi possível conectar com o servidor de contas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = {
    width: "100%", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
    height: 44, padding: "0 16px", fontFamily: FONT_BODY, fontSize: 16, color: TEXT, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", height: 80, padding: isMobile ? "0 16px" : "0 80px" }}>
        <Wordmark onClick={onHome} />
      </div>
      <div style={{ height: 1, background: BORDER, width: "100%" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: isMobile ? "32px 16px" : "48px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 36, color: TEXT, margin: 0, textAlign: "center" }}>Crie sua conta</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 16, color: BODY, margin: 0, textAlign: "center", maxWidth: 600 }}>Preencha os dados abaixo para criar sua conta.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: isMobile ? "100%" : 500 }}>
          <div onClick={handleGoogleSignup} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: 260, maxWidth: "100%", cursor: "pointer" }}>
            <Icon name="google" size={24} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>Entrar com Google</p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Já tem conta?</p>
            <p onClick={onLogin} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0, cursor: "pointer" }}>Entrar</p>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", width: "100%" }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>ou</p>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Cadastro</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Nome</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" style={fieldStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>E-mail</p>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" style={fieldStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>WhatsApp</p>
              <input value={whatsapp} onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))} placeholder="(99) 99999-9999" style={fieldStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Senha</p>
              <div style={{ position: "relative" }}>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Crie uma senha segura" style={{ ...fieldStyle, paddingRight: 48 }} />
                <div onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Confirmar senha</p>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateAccount(); }}
                  placeholder="Repita a senha"
                  style={{ ...fieldStyle, paddingRight: 48 }}
                />
                <div onClick={() => setShowConfirm((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: BODY, margin: 0 }}>Critérios da senha</p>
              <CriteriaDot ok={passChecks.upper} label="Pelo menos 1 letra maiúscula" />
              <CriteriaDot ok={passChecks.lower} label="Pelo menos 1 letra minúscula" />
              <CriteriaDot ok={passChecks.len} label="No mínimo 8 caracteres" />
            </div>

            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}

            <div onClick={loading ? undefined : handleCreateAccount} style={{ background: GREEN_BUTTON, opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: "100%", cursor: loading ? "default" : "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{loading ? "Criando conta..." : "Criar conta"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
