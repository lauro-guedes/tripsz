"use client";
/**
 * Convite "pendente" no navegador, e o resgate — SÓ no navegador.
 *
 * Por que guardar o código: quem cria a conta pelo Google sai do site e volta; quem cria por e-mail pode ter
 * que confirmar o e-mail antes. Nos dois casos, o código fica aqui e o app resgata na primeira sessão.
 * O resgate é feito no SERVIDOR (/api/invites/<código>/redeem), que acha o convite pelo CÓDIGO — nunca pelo
 * e-mail digitado — e é idempotente (repetir não duplica o jogo).
 */
import { authFetch } from "./authFetch";
import { INVITE_CODE_RE } from "./invites";

const PENDING_KEY = "tripsz_pending_invite";
const WELCOME_KEY = "tripsz_invite_welcome";
const MAX_AGE_MS = 14 * 24 * 3600 * 1000; // o convite vale 14 dias; depois disso não adianta guardar

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // navegador sem armazenamento: o resgate ainda pode ser feito pela página do convite
  }
};

export function savePendingInvite(code) {
  if (INVITE_CODE_RE.test(code || "")) write(PENDING_KEY, { code, at: Date.now() });
}

/** O código guardado (ou null, se não há, está mal formado ou já passou de 14 dias). */
export function readPendingInvite() {
  const v = read(PENDING_KEY);
  if (!v || !INVITE_CODE_RE.test(v.code || "") || Date.now() - (v.at || 0) > MAX_AGE_MS) return null;
  return v.code;
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // sem armazenamento
  }
}

/** Dados da tela de boas-vindas (quem convidou, o jogo, se já era dela). */
export function saveWelcome(payload) {
  write(WELCOME_KEY, payload);
}
export function readWelcome() {
  return read(WELCOME_KEY);
}
export function clearWelcome() {
  try {
    localStorage.removeItem(WELCOME_KEY);
  } catch {
    // sem armazenamento
  }
}

/** Erros que não adianta tentar de novo (o convite não vai passar a valer). */
export const FINAL_INVITE_ERRORS = ["not_found", "expired", "used", "own_invite"];

/** Resgata o convite pra pessoa logada. Nunca lança: devolve { ok: true, ... } ou { ok: false, code, message }. */
export async function redeemInviteCode(code) {
  try {
    const res = await authFetch(`/api/invites/${encodeURIComponent(code)}/redeem`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) return body;
    return { ok: false, code: body.error || "server", message: body.message || "Não foi possível resgatar o convite agora.", status: res.status };
  } catch {
    return { ok: false, code: "network", message: "Sem conexão. Verifique a internet e tente de novo." };
  }
}

/** Resgata e deixa pronta a tela de boas-vindas. */
export async function redeemAndPrepareWelcome(code) {
  const r = await redeemInviteCode(code);
  if (r.ok) saveWelcome({ gameId: r.gameId, duplicate: !!r.duplicate, already: !!r.already, game: r.game, inviter: r.inviter, at: Date.now() });
  return r;
}
