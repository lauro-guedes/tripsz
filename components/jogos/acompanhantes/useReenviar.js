"use client";
import { useState } from "react";
import { defaultInviteMessage } from "../../../lib/invites";
import { resendInvite } from "../../../lib/companionsClient";
import { deliverInvite, openBlankWindow } from "../../../lib/inviteDelivery";

const NOTE = {
  whatsapp: "Abrimos o WhatsApp com o novo link. Escolha o contato e envie.",
  email: "Abrimos o seu e-mail com o novo link. É só enviar.",
  copied: "Novo link copiado. É só colar na conversa.",
};

/** "Reenviar convite": cria um link novo (o antigo deixa de valer) e entrega de novo pelo mesmo canal. Não guardamos o contato, então no WhatsApp/e-mail a pessoa escolhe o destinatário. */
export function useReenviar({ game, onDone }) {
  const [busyId, setBusyId] = useState(null);
  const [note, setNote] = useState(null);

  const resend = async (invite) => {
    if (busyId) return;
    setBusyId(invite.id);
    setNote(null);
    const popup = invite.channel === "whatsapp" ? openBlankWindow() : null;
    const r = await resendInvite(invite.id);
    if (!r.ok) {
      if (popup) popup.close();
      setBusyId(null);
      return setNote({ type: "error", text: r.message });
    }
    const how = await deliverInvite({ channel: invite.channel, message: defaultInviteMessage(game), url: r.url, contact: "", popup });
    setNote(how === "copy_failed" ? { type: "info", text: `Não foi possível copiar sozinho. Copie o link: ${r.url}` } : { type: "info", text: NOTE[how] });
    setBusyId(null);
    if (onDone) await onDone();
  };

  return { busyId, note, resend };
}
