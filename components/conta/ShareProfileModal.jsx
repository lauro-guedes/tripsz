"use client";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { Check, Clipboard, Instagram, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Modal "Compartilhar perfil": atalhos pra WhatsApp, Instagram, o menu de
 * compartilhar do celular e copiar o link.
 *
 * O Instagram não tem um endereço de "compartilhar link" como o WhatsApp, então
 * o botão copia o link e abre o Instagram — a pessoa cola na bio, no story
 * (adesivo de link) ou no direct.
 */
/** Logo oficial do WhatsApp (balão com o telefone). */
function WhatsAppIcon({ size = 24, color = "#fff" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function ShareProfileModal({ link, name, onClose }) {
  const [copied, setCopied] = useState(false);
  const [instaHint, setInstaHint] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const message = `Olha o meu Passaporte de Estádios na tripsz${name ? `, ${name.split(" ")[0]}` : ""}: estádios visitados, jogos e conquistas. ${link}`;

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

  // O Instagram não aceita "enviar link pra fulano" por endereço. No celular, o
  // menu de compartilhar do sistema lista o Instagram e deixa escolher a pessoa
  // do Direct; no computador, copiamos o link e abrimos o Direct na web.
  const shareInstagram = async () => {
    if (canNativeShare) {
      await shareNative();
      return;
    }
    await copy();
    setInstaHint(true);
    window.open("https://www.instagram.com/direct/inbox/", "_blank", "noopener,noreferrer");
  };

  const shareNative = async () => {
    try {
      await navigator.share({ title: "Meu Passaporte de Estádios", text: "Meu Passaporte de Estádios na tripsz", url: link });
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
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, maxHeight: "calc(100dvh - 32px)", overflowY: "auto", boxSizing: "border-box", padding: 24, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0px 20px 40px rgba(15,23,42,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <p id="share-title" style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Compartilhar perfil</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.4, color: BODY, margin: "4px 0 0" }}>Mostre seu Passaporte de Estádios para os amigos.</p>
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
            <div style={iconBox("#25D366")}><WhatsAppIcon size={24} /></div>
            <div><p style={label}>WhatsApp</p><p style={sub}>Enviar o link numa conversa ou grupo</p></div>
          </div>

          <div onClick={shareInstagram} style={optionStyle}>
            <div style={iconBox("linear-gradient(45deg,#f9a03f,#e1306c,#833ab4)")}><Instagram size={22} color="#fff" /></div>
            <div><p style={label}>Instagram</p><p style={sub}>{canNativeShare ? "Escolha o Instagram e a pessoa no Direct" : "Copia o link e abre o Direct do Instagram"}</p></div>
          </div>
          {instaHint && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, lineHeight: 1.4, color: BODY, margin: "-4px 0 0", padding: "0 4px" }}>
              Link copiado! No Direct, abra a conversa com quem quiser e cole o link (ou use na bio e no story, com o adesivo de link).
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
