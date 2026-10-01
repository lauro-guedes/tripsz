"use client";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";

const GREEN = "#00c853";
const GREEN_BUTTON = "#00e676";
const BG = "#f8fafc";
const BORDER = "#e2e8f0";
const TEXT = "#0f172a";
const BODY = "#334155";
const MUTED = "#64748b";

function CriteriaDot({ met, label }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div style={{ width: 6, height: 6, borderRadius: 3, background: met ? GREEN : MUTED, flexShrink: 0 }} />
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: met ? GREEN : MUTED, margin: 0 }}>{label}</p>
    </div>
  );
}

export default function RedefinirSenhaPage() {
  const [status, setStatus] = useState("loading"); // loading | ready | invalid | success
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    // O Supabase processa o link de recuperação sozinho (vem na própria
    // URL) e dispara esse evento quando a sessão temporária de troca de
    // senha fica pronta pra usar.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    // Se a sessão já tiver sido processada antes desse listener montar,
    // confirma direto.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus((s) => (s === "loading" ? "ready" : s));
    });

    const timeout = setTimeout(() => {
      setStatus((s) => (s === "loading" ? "invalid" : s));
    }, 4000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasLength = password.length >= 8;
  const passwordsMatch = password && password === confirmPassword;
  const canSubmit = hasUpper && hasLower && hasLength && passwordsMatch;

  const handleSubmit = async () => {
    setError(null);
    if (!canSubmit) {
      setError("Confirme os critérios da senha e repita ela igual nos dois campos.");
      return;
    }
    setSaving(true);
    try {
      const supabase = supabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus("success");
    } catch (e) {
      setError(e.message || "Não foi possível trocar a senha. Tente pedir um novo link.");
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    width: "100%",
    background: "#fff",
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    height: 48,
    padding: "0 16px",
    paddingRight: 48,
    fontFamily: "Lora, serif",
    fontSize: 16,
    color: TEXT,
    outline: "none",
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, width: 440, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
        <p style={{ fontWeight: 800, fontSize: 20, color: TEXT, margin: 0 }}>tripsz</p>

        {status === "loading" && (
          <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Confirmando seu link de redefinição...</p>
        )}

        {status === "invalid" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Link inválido ou expirado</p>
            <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Peça um novo link de redefinição de senha na tela de login.</p>
            <a href="/" style={{ fontWeight: 700, fontSize: 14, color: GREEN, textDecoration: "none" }}>Voltar pro tripsz</a>
          </div>
        )}

        {status === "success" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: "rgba(0,200,83,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={24} color={GREEN} />
            </div>
            <p style={{ fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Senha atualizada com sucesso</p>
            <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Já pode entrar no tripsz usando sua nova senha.</p>
            <a href="/" style={{ background: GREEN_BUTTON, borderRadius: 12, padding: "14px 24px", textAlign: "center", textDecoration: "none" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>Ir para o login</p>
            </a>
          </div>
        )}

        {status === "ready" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Defina sua nova senha</p>
              <p style={{ fontSize: 14, color: MUTED, margin: "6px 0 0" }}>Escolha uma senha forte, que você ainda não tenha usado aqui.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Nova senha</p>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Crie uma senha segura"
                  style={fieldStyle}
                />
                <div onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Confirmar nova senha</p>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                placeholder="Repita a senha"
                style={{ ...fieldStyle, paddingRight: 16 }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ fontWeight: 700, fontSize: 12, color: BODY, margin: 0 }}>Critérios da senha</p>
              <CriteriaDot met={hasUpper} label="Pelo menos 1 letra maiúscula" />
              <CriteriaDot met={hasLower} label="Pelo menos 1 letra minúscula" />
              <CriteriaDot met={hasLength} label="No mínimo 8 caracteres" />
            </div>

            {error && <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}

            <div onClick={saving ? undefined : handleSubmit} style={{ background: GREEN_BUTTON, opacity: saving ? 0.6 : 1, borderRadius: 12, padding: "14px 24px", textAlign: "center", cursor: saving ? "default" : "pointer" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{saving ? "Salvando..." : "Redefinir senha"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
