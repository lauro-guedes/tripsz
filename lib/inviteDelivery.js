"use client";
/**
 * Entrega do convite pelo celular/computador da PESSOA: abre o WhatsApp ou o e-mail já com a mensagem, copia o
 * link ou usa o compartilhamento nativo. O servidor não envia nada e não guarda telefone nem e-mail.
 */
import { buildMailtoUrl, buildWhatsAppUrl, INVITE_EMAIL_SUBJECT } from "./invites";
import { navigate } from "./navigate";

/** O link vai no fim da mensagem. */
export const withLink = (message, url) => `${String(message || "").trim()}\n${url}`.trim();

/**
 * O navegador só deixa abrir uma janela nova NO CLIQUE, e o convite leva um instante pra ser criado no servidor.
 * Por isso a janela em branco é aberta já no clique e preenchida depois.
 */
export function openBlankWindow() {
  try {
    return window.open("about:blank", "_blank");
  } catch {
    return null;
  }
}

/** Devolve "whatsapp" | "email" | "copied" | "copy_failed". */
export async function deliverInvite({ channel, message, url, contact, popup }) {
  if (channel === "whatsapp") {
    const wa = buildWhatsAppUrl(contact, withLink(message, url));
    if (popup && !popup.closed) popup.location.href = wa;
    else navigate(wa);
    return "whatsapp";
  }
  if (channel === "email") {
    navigate(buildMailtoUrl(contact, INVITE_EMAIL_SUBJECT, withLink(message, url)));
    return "email";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "copy_failed";
  }
}

export const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/** Compartilhamento nativo do aparelho. "shared" | "cancelled" | "copied" | "copy_failed" (cai na cópia se o aparelho recusar). */
export async function shareInvite({ message, url }) {
  try {
    await navigator.share({ title: "tripsz", text: String(message || "").trim(), url });
    return "shared";
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelled";
  }
  try {
    await navigator.clipboard.writeText(withLink(message, url));
    return "copied";
  } catch {
    return "copy_failed";
  }
}
