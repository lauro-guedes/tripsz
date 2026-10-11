"use client";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { Check, Clipboard, Instagram, MessageCircle, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Modal "Compartilhar perfil": atalhos pra WhatsApp, Instagram, o menu de
 * compartilhar do celular e copiar o link.
 *
 * O Instagram não tem um endereço de "compartilhar link" como o WhatsApp, então
 * o botão copia o link e abre o Instagram — a pessoa cola na bio, no story
 * (adesivo de link) ou no direct.
 */
export function ShareProfileModal({ link, name, onClose }) {
  const [copied, setCopied] = useState(false);
  const [instaHint, setInstaHint] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const message = `Olha o meu Football Passport na tripsz${name ? `, ${name.split(" ")[0]}` : ""}: estádios visitados, jogos e conquistas. ${link}`;

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const shareInstagram = async () => {
    await copy();
    setInstaHint(true);
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  };

  const shareNative = async () => {
    try {
      await navigator.share({ title: "Meu Football Passport", text: "Meu Football Passport na tripsz", url: link });
    } catch {
      // a pessoa fechou o menu — não é erro
    }
  };

  const optionStyle = { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: `1px solid ${BORDER}`, borderRadius: 12, background: "#fff", cursor: "pointer" };
  const iconBox = (bg) => ({ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });
  const label = { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, margin: 0 };
  const sub = { fontFamily: FONT_BODY, fontSize: 12, color: MUTED, margin: "2px 0 0" };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: 24, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0px 20px 40px rgba(15,23,42,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <p id="share-title" style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Compartilhar perfil</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.4, color: BODY, margin: "4px 0 0" }}>Mostre seu Football Passport para os amigos.</p>
          </div>
          <div onClick={onClose} role="button" aria-label="Fechar" style={{ cursor: "pointer", display: "flex", padding: 4 }}>
            <X size={20} color={MUTED} />
          </div>
        </div>

        <div style={{ background: BG, borderRadius: 8, padding: "10px 12px" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTED, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.replace(/^https?:\/\//, "")}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div onClick={shareWhatsApp} style={optionStyle}>
            <div style={iconBox("#25D366")}><MessageCircle size={22} color="#fff" /></div>
            <div><p style={label}>WhatsApp</p><p style={sub}>Enviar o link numa conversa ou grupo</p></div>
          </div>

          <div onClick={shareInstagram} style={optionStyle}>
            <div style={iconBox("linear-gradient(45deg,#f9a03f,#e1306c,#833ab4)")}><Instagram size={22} color="#fff" /></div>
            <div><p style={label}>Instagram</p><p style={sub}>Copia o link e abre o Instagram</p></div>
          </div>
          {instaHint && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, lineHeight: 1.4, color: BODY, margin: "-4px 0 0", padding: "0 4px" }}>
              Link copiado! No Instagram, cole na bio, no direct ou no story (adesivo de link).
            </p>
          )}

          {canNativeShare && (
            <div onClick={shareNative} style={optionStyle}>
              <div style={iconBox(GREEN)}><Share2 size={20} color="#fff" /></div>
              <div><p style={label}>Mais opções</p><p style={sub}>Telegram, e-mail, mensagens e outros apps</p></div>
            </div>
          )}

          <div onClick={copy} style={optionStyle}>
            <div style={iconBox(BG)}>{copied ? <Check size={20} color={GREEN} /> : <Clipboard size={20} color={MUTED} />}</div>
            <div><p style={label}>{copied ? "Link copiado!" : "Copiar link"}</p><p style={sub}>Colar em qualquer lugar</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
