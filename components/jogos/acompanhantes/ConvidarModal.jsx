"use client";
import { Link2, Mail, MessageCircle, Pencil, ShieldCheck, Share2, X } from "lucide-react";
import { canShare } from "../../../lib/inviteDelivery";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../../lib/tokens";
import { useIsMobile } from "../../ui/useIsMobile";
import { Field, GREEN_TINT, Message, SecondaryBtn, text } from "../../convite/ConviteUi";
import { matchPlace, matchTitle, mono, useBodyLock } from "./ui";
import { useConvidar } from "./useConvidar";

const CHANNELS = { whatsapp: { label: "WhatsApp", Icon: MessageCircle }, email: { label: "E-mail", Icon: Mail }, link: { label: "Copiar link", Icon: Link2 } };
const DONE_TEXT = {
  whatsapp: "Abrimos o WhatsApp com a mensagem pronta. É só enviar.",
  email: "Abrimos o seu e-mail com a mensagem pronta. É só enviar.",
  copied: "Link copiado. É só colar na conversa.",
  shared: "Convite compartilhado.",
  cancelled: "Você fechou o compartilhamento. O link está abaixo, caso queira copiar.",
  copy_failed: "Não foi possível copiar sozinho. Copie o link abaixo.",
};

function ActionBtn({ primary, icon: Icon, children, onClick, disabled }) {
  return (
    <div role="button" aria-disabled={disabled} onClick={disabled ? undefined : onClick} style={{ background: primary ? GREEN : "#fff", border: `1px solid ${primary ? GREEN : BORDER}`, borderRadius: 12, height: 48, padding: "0 16px", boxSizing: "border-box", display: "flex", gap: 8, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.6 : 1, cursor: disabled ? "default" : "pointer", flex: 1, minWidth: 0 }}>
      {Icon && <Icon size={16} color={TEXT} />}
      <p style={text(13, TEXT, { fontWeight: 700, lineHeight: "normal" })}>{children}</p>
    </div>
  );
}

/** Modal "Convidar alguém novo" (folha de baixo pra cima no celular). */
export function ConvidarModal({ game, onClose, onCreated }) {
  const isMobile = useIsMobile();
  useBodyLock();
  const c = useConvidar({ game, onCreated });
  const first = c.name.trim().split(/\s+/)[0];
  const order = [c.channel, ...Object.keys(CHANNELS).filter((k) => k !== c.channel)];
  const contactLabel = c.channel === "email" ? `E-mail de ${first || "quem você convida"}` : `WhatsApp de ${first || "quem você convida"}`;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: isMobile ? "flex-end" : "flex-start", justifyContent: "center", padding: isMobile ? 0 : "40px 24px", overflowY: "auto" }}>
      <div role="dialog" aria-modal="true" aria-label="Convidar alguém novo" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: isMobile ? "100%" : 600, borderRadius: isMobile ? "20px 20px 0 0" : 12, padding: isMobile ? 20 : 28, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20, maxHeight: isMobile ? "92vh" : undefined, overflowY: isMobile ? "auto" : undefined }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <p style={{ ...text(22, TEXT, { fontWeight: 700 }), flex: 1 }}>Convidar alguém novo</p>
          <span role="button" aria-label="Fechar" onClick={onClose} style={{ cursor: "pointer", display: "flex" }}>
            <X size={20} color={TEXT} />
          </span>
        </div>
        <p style={text(13)}>Convide quem dividiu a arquibancada com você, mesmo sem uma conta no tripsz.</p>
        <div style={{ background: GREEN_TINT, borderRadius: 12, padding: "5px 9px", alignSelf: "flex-start" }}>
          <p style={text(10, GREEN_DARK, { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, lineHeight: "normal" })}>{[matchTitle(game), game.stadium && matchPlace({ stadium: game.stadium })].filter(Boolean).join(" · ")}</p>
        </div>

        {c.done ? (
          <>
            <div style={{ background: GREEN_TINT, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={text(15, TEXT, { fontWeight: 700 })}>Convite criado para {c.done.name}</p>
              <p style={text(13)}>{DONE_TEXT[c.done.how]}</p>
              {c.done.url && <input readOnly value={c.done.url} aria-label="Link do convite" onFocus={(e) => e.target.select()} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px", fontFamily: FONT_DISPLAY, fontSize: 12, color: TEXT, background: "#fff" }} />}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <ActionBtn onClick={c.reset}>Convidar outra pessoa</ActionBtn>
              <ActionBtn primary onClick={onClose}>Concluir</ActionBtn>
            </div>
          </>
        ) : (
          <>
            <Field label="Nome" value={c.name} onChange={c.setName} autoComplete="off" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={mono(10)}>Como você quer enviar?</p>
              <div style={{ display: "flex", gap: 8 }}>
                {Object.entries(CHANNELS).map(([k, v]) => {
                  const on = c.channel === k;
                  return (
                    <div key={k} role="button" aria-pressed={on} onClick={() => c.setChannel(k)} style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 12, border: `1px solid ${on ? GREEN : BORDER}`, background: on ? GREEN_TINT : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <p style={text(12, on ? GREEN_DARK : MUTED, { fontWeight: 600, lineHeight: "normal" })}>{v.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            {c.channel !== "link" && <Field label={contactLabel} value={c.contact} onChange={c.setContact} type={c.channel === "email" ? "email" : "tel"} placeholder={c.channel === "email" ? "nome@email.com" : "(11) 99999-0123"} />}
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={mono(10)}>Prévia da mensagem · Editável</span>
              <span style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <textarea value={c.message} onChange={(e) => c.setMessage(e.target.value)} rows={3} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", resize: "vertical", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 14, lineHeight: 1.55, color: TEXT }} />
                <Pencil size={16} color={MUTED} />
              </span>
            </label>
            <Message msg={c.error ? { type: "error", text: c.error } : null} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(() => {
                const P = CHANNELS[order[0]];
                return <ActionBtn primary icon={P.Icon} onClick={() => c.send(order[0])} disabled={c.busy}>{c.busy ? "Criando o convite..." : P.label}</ActionBtn>;
              })()}
              <div style={{ display: "flex", gap: 12 }}>
                {order.slice(1).map((k) => (
                  <ActionBtn key={k} icon={CHANNELS[k].Icon} onClick={() => c.send(k)} disabled={c.busy}>{CHANNELS[k].label}</ActionBtn>
                ))}
              </div>
              {canShare() && <SecondaryBtn onClick={() => c.send("share")} disabled={c.busy} icon={<Share2 size={16} color={TEXT} />}>Compartilhar pelo aparelho</SecondaryBtn>}
              <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck size={14} color={MUTED} />
                <p style={text(12, MUTED, { lineHeight: "normal" })}>Não guardamos contatos.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
