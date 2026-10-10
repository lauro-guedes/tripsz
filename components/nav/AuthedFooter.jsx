"use client";
import { supabaseBrowser } from "../../lib/supabase";
import { BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import SocialLinks from "../SocialLinks";
import { Wordmark } from "../ui/Wordmark";
import { useIsMobile } from "../ui/useIsMobile";
import { useState } from "react";

export function AuthedFooter() {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState(null);

  const handleSubscribe = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Digite um e-mail válido.");
      return;
    }
    setStatus("loading");
    const supabase = supabaseBrowser();
    const { error: insertError } = await supabase.from("newsletter_subscribers").insert({ email });
    if (insertError) {
      // Código 23505 = e-mail duplicado (já inscrito) — trata como sucesso,
      // não faz sentido mostrar erro pra quem já está na lista.
      if (insertError.code === "23505") {
        setStatus("success");
        return;
      }
      setError("Não foi possível concluir a inscrição. Tente novamente.");
      setStatus("idle");
      return;
    }
    setStatus("success");
  };

  return (
    <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, padding: isMobile ? "40px 16px 24px" : "80px 80px 40px", display: "flex", flexDirection: "column", gap: isMobile ? 32 : 64 }}>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 32 : 0, alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: isMobile ? "100%" : 360 }}>
          <Wordmark />
          <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: BODY, margin: 0 }}>Somos uma plataforma pra montar roteiros de futebol e registrar seus jogos e estádios mundo afora. Ah, e se precisar, te ajudamos com consultoria pra voos, ingressos e hospedagem.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: isMobile ? "100%" : "auto" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Redes sociais</p>
          <SocialLinks />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: isMobile ? "100%" : 300 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Fique por dentro</p>
          {status === "success" ? (
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: GREEN, margin: 0 }}>Prontinho! Você vai receber nossos alertas por e-mail.</p>
          ) : (
            <>
              <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: BODY, margin: 0 }}>Receba alertas de pacotes especiais para derbies e finais europeias.</p>
              <div style={{ display: "flex", gap: 8, width: "100%" }}>
                <div style={{ background: BG_ALT, border: `1px solid ${BORDER}`, borderRadius: 6, flex: 1, height: 44, display: "flex", alignItems: "center", padding: 12 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
                    placeholder="Seu melhor e-mail"
                    style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 13, color: TEXT }}
                  />
                </div>
                <div onClick={status === "loading" ? undefined : handleSubscribe} style={{ background: GREEN_BUTTON, opacity: status === "loading" ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 8, cursor: status === "loading" ? "default" : "pointer", flexShrink: 0 }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>OK</p>
                </div>
              </div>
              {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>{error}</p>}
            </>
          )}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 24, display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 0, justifyContent: "space-between" }}>
        <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTED, margin: 0 }}>© 2026 tripsz. Todos os direitos reservados.</p>
        <div style={{ display: "flex", gap: isMobile ? 16 : 32, alignItems: "flex-start", flexWrap: "wrap" }}>
          <a href="/termos" style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, textDecoration: "none" }}>Termos</a>
          <a href="/privacidade" style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, textDecoration: "none" }}>Privacidade</a>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Contato</p>
        </div>
      </div>
    </div>
  );
}
