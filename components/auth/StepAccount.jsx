"use client";
import { supabaseBrowser } from "../../lib/supabase";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, GREEN, GREEN_BUTTON2, MUTED, TEXT } from "../../lib/tokens";
import { MobileProgress, WIZARD_TOTAL, WizardBottomBar } from "../nav/WizardChrome";
import { Icon } from "../ui/Icon";
import { Wordmark } from "../ui/Wordmark";
import { useIsMobile } from "../ui/useIsMobile";
import { CriteriaDot } from "./CriarConta";
import { LoginModal } from "./LoginModal";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function StepAccount({ answers, setAnswers, onNext, onBack, openLogin }) {
  const set = (k, v) => setAnswers((a) => ({ ...a, [k]: v }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({});

  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  const formatWhatsapp = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.replace(/^(\d*)/, "($1");
    if (digits.length <= 7) return digits.replace(/^(\d{2})(\d*)/, "($1) $2");
    return digits.replace(/^(\d{2})(\d{5})(\d*)/, "($1) $2-$3");
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email || "");
  const password = answers.password || "";
  const passChecks = {
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    len: password.length >= 8,
  };
  const passwordValid = passChecks.upper && passChecks.lower && passChecks.len;
  const confirmValid = (answers.passwordConfirm || "") === password && password.length > 0;
  const nameValid = (answers.name || "").trim().length > 1;
  const whatsappDigits = (answers.whatsapp || "").replace(/\D/g, "");
  const whatsappValid = whatsappDigits.length === 10 || whatsappDigits.length === 11;

  const [showLoginModal, setShowLoginModal] = useState(!!openLogin);
  const isMobile = useIsMobile();

  const handleGoogleLogin = async () => {
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    // O Supabase redireciona pro Google e volta sozinho; o onAuthStateChange
    // no App() detecta a sessão e avança o passo automaticamente.
  };

  const handleCreateAccount = async () => {
    setError(null);
    setTouched({ name: true, email: true, whatsapp: true, password: true, passwordConfirm: true });

    if (!nameValid) return setError("Preencha seu nome completo.");
    if (!emailValid) return setError("Digite um e-mail válido.");
    if (!whatsappValid) return setError("Digite um WhatsApp válido, com DDD.");
    if (!passwordValid) return setError("A senha precisa atender aos critérios abaixo.");
    if (!confirmValid) return setError("As senhas não coincidem.");

    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase.auth.signUp({
        email: answers.email,
        password: answers.password,
        options: { data: { name: answers.name, whatsapp: answers.whatsapp } },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setAnswers((a) => ({ ...a, userId: data.user?.id }));
      onNext();
    } catch (e) {
      setError("Não foi possível conectar com o servidor de contas. Tente novamente.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 16px" : "24px 80px", width: "100%" }}>
          <Wordmark onClick={onBack} />
          <p onClick={onBack} style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 12 : 14, color: MUTED, cursor: "pointer", margin: 0 }}>{isMobile ? "Sair" : "Sair do questionário"}</p>
        </div>
        <div style={{ height: 1, background: BORDER, width: "100%" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 20 : 32, alignItems: "center", padding: isMobile ? "0 16px" : "0 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: "center", textAlign: "center" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Acesse sua conta</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 600, margin: 0, textAlign: "center" }}>Entre com o Google ou crie sua conta para continuar com o roteiro.</p>
        </div>

        {isMobile ? (
          <MobileProgress step={1} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: 800 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Passo 1 de {WIZARD_TOTAL}</p>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {Array.from({ length: WIZARD_TOTAL }, (_, i) => i + 1).map((n) => (
                  <div key={n} style={{ background: n === 1 ? GREEN_BUTTON2 : BORDER, width: 24, height: 24, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: n === 1 ? TEXT : MUTED, margin: 0 }}>{n}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>{Math.round((1 / WIZARD_TOTAL) * 100)}% Concluído</p>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24, alignItems: "center", width: isMobile ? "100%" : 800 }}>
          <div onClick={handleGoogleLogin} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: "100%", cursor: "pointer" }}>
            <Icon name="google" size={20} color={TEXT} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 13 : 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{isMobile ? "Cadastrar com Google" : "Entrar com Google"}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 12 : 14, color: MUTED, margin: 0 }}>Já tem conta?</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 12 : 14, color: GREEN, margin: 0, cursor: "pointer" }} onClick={() => { setShowLoginModal(true); }}>Entrar</p>
          </div>
          {error && (
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0, width: "100%" }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: 12, alignItems: "center", width: "100%" }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>ou</p>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Criar conta</p>

            {/* Nome */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Nome</p>
              <input
                type="text"
                value={answers.name || ""}
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => touch("name")}
                placeholder="Seu nome completo"
                style={fieldStyle(touched.name && !nameValid)}
              />
              {touched.name && !nameValid && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>Digite seu nome completo.</p>
              )}
            </div>

            {/* E-mail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>E-mail</p>
              <input
                type="email"
                value={answers.email || ""}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => touch("email")}
                placeholder="nome@exemplo.com"
                style={fieldStyle(touched.email && !emailValid)}
              />
              {touched.email && !emailValid && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>Digite um e-mail válido.</p>
              )}
            </div>

            {/* WhatsApp */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>WhatsApp</p>
              <input
                type="tel"
                inputMode="numeric"
                value={answers.whatsapp || ""}
                onChange={(e) => set("whatsapp", formatWhatsapp(e.target.value))}
                onBlur={() => touch("whatsapp")}
                placeholder="(99) 99999-9999"
                maxLength={15}
                style={fieldStyle(touched.whatsapp && !whatsappValid)}
              />
              {touched.whatsapp && !whatsappValid && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>Digite um WhatsApp válido, com DDD.</p>
              )}
            </div>

            {/* Senha */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Senha</p>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => set("password", e.target.value)}
                  onBlur={() => touch("password")}
                  placeholder="Crie uma senha segura"
                  style={{ ...fieldStyle(touched.password && !passwordValid), paddingRight: 48 }}
                />
                <div onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
              </div>
            </div>

            {/* Confirmar senha */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Confirmar senha</p>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={answers.passwordConfirm || ""}
                  onChange={(e) => set("passwordConfirm", e.target.value)}
                  onBlur={() => touch("passwordConfirm")}
                  placeholder="Repita a senha"
                  style={{ ...fieldStyle(touched.passwordConfirm && !confirmValid), paddingRight: 48 }}
                />
                <div onClick={() => setShowConfirm((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
              </div>
              {touched.passwordConfirm && !confirmValid && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>As senhas não coincidem.</p>
              )}
            </div>

            {/* Critérios da senha */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: BODY, margin: 0 }}>Critérios da senha</p>
              <CriteriaDot ok={passChecks.upper} label="Pelo menos 1 letra maiúscula" />
              <CriteriaDot ok={passChecks.lower} label="Pelo menos 1 letra minúscula" />
              <CriteriaDot ok={passChecks.len} label="No mínimo 8 caracteres" />
            </div>

            <div onClick={handleCreateAccount} style={{ background: GREEN_BUTTON2, opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: "100%", cursor: loading ? "default" : "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{loading ? "Criando conta..." : "Criar conta"}</p>
            </div>
          </div>
        </div>
      </div>

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      <WizardBottomBar
        onBack={onBack}
        onNext={async () => {
          const supabase = supabaseBrowser();
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setError("Entre com Google ou crie sua conta antes de continuar.");
            return;
          }
          setAnswers((a) => ({ ...a, userId: data.session.user.id }));
          onNext();
        }}
      />
    </div>
  );
}
