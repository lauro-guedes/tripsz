/**
 * Código secreto do convite — SÓ no servidor.
 * 128 bits aleatórios (22 caracteres na URL). No banco vai apenas o hash SHA-256 dele.
 */
import { createHash, randomBytes } from "node:crypto";
import { INVITE_CODE_RE } from "./invites";

export function newInviteCode() {
  return randomBytes(16).toString("base64url");
}

export function hashInviteCode(code) {
  return createHash("sha256").update(String(code)).digest("hex");
}

/** O texto parece um código? (evita ir ao banco com lixo) */
export function looksLikeInviteCode(code) {
  return typeof code === "string" && INVITE_CODE_RE.test(code);
}
