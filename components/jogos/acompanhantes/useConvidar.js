"use client";
import { useState } from "react";
import { cleanInviteeName, defaultInviteMessage, normalizePhone } from "../../../lib/invites";
import { createInvite } from "../../../lib/companionsClient";
import { deliverInvite, openBlankWindow, shareInvite } from "../../../lib/inviteDelivery";

/**
 * "Convidar alguém novo": cria o convite no servidor (só com o NOME) e entrega pelo canal escolhido.
 * O telefone/e-mail digitado serve só pra montar o link do WhatsApp/e-mail: nunca é enviado nem guardado.
 */
export function useConvidar({ game, onCreated }) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState(() => defaultInviteMessage(game));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null); // { name, how, url } depois de criar

  const reset = () => {
    setName("");
    setContact("");
    setError(null);
    setDone(null);
  };

  /** `ch`: "whatsapp" | "email" | "link" | "share" (compartilhamento nativo do aparelho). */
  const send = async (ch) => {
    if (busy) return;
    const nm = cleanInviteeName(name);
    if (!nm) return setError("Informe o nome de quem você quer convidar.");
    if (ch === "whatsapp" && contact.trim() && !normalizePhone(contact)) return setError("Esse número de WhatsApp parece inválido. Confira o DDD, ou deixe em branco para escolher o contato no WhatsApp.");
    setError(null);
    setBusy(true);
    const popup = ch === "whatsapp" ? openBlankWindow() : null; // tem que abrir já no clique, antes de esperar o servidor
    const r = await createInvite(game.id, nm, ch === "share" ? "link" : ch);
    if (!r.ok) {
      if (popup) popup.close();
      setBusy(false);
      return setError(r.message);
    }
    const how = ch === "share" ? await shareInvite({ message, url: r.url }) : await deliverInvite({ channel: ch, message, url: r.url, contact: ch === "link" ? "" : contact, popup });
    if (onCreated) onCreated({ id: r.invite.id, inviteeName: r.invite.inviteeName, channel: r.invite.channel, status: r.invite.status });
    // Se não deu pra enviar/copiar sozinho, o link fica na tela (o servidor não guarda o código, só o hash).
    setDone({ name: nm, how, url: how === "copy_failed" || how === "cancelled" ? r.url : null });
    setBusy(false);
  };

  return { name, setName, channel, setChannel, contact, setContact, message, setMessage, busy, error, done, reset, send };
}
