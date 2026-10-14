"use client";
/**
 * Chamadas do navegador à API de acompanhantes e convites. Nunca lançam: devolvem { ok: true, ... } ou
 * { ok: false, code, message } (a mensagem já vem em português, pronta pra mostrar).
 */
import { authFetch } from "./authFetch";

async function call(url, options) {
  try {
    const res = await authFetch(url, options);
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok !== false) return { ok: true, ...body };
    return { ok: false, code: body.error || "server", message: body.message || "Não foi possível concluir agora. Tente de novo.", status: res.status };
  } catch {
    return { ok: false, code: "network", message: "Sem conexão. Verifique a internet e tente de novo." };
  }
}
const post = (url, body) => call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

export const searchFriend = (q) => call(`/api/friends/search?q=${encodeURIComponent(q)}`);
export const fetchFriends = () => call("/api/friends");
export const tagCompanions = (gameId, usernames) => post(`/api/games/${gameId}/companions`, { usernames });
export const fetchCompanionsMap = () => call("/api/games/companions");
export const fetchCompanionRequests = () => call("/api/companion-requests");
export const acceptRequest = (id) => post(`/api/companion-requests/${id}/accept`);
export const ignoreRequest = (id) => post(`/api/companion-requests/${id}/ignore`);
export const createInvite = (gameId, inviteeName, channel) => post("/api/invites", { gameId, inviteeName, channel });
export const listInvites = (gameId) => call(`/api/invites?gameId=${encodeURIComponent(gameId)}`);
export const resendInvite = (inviteId) => post(`/api/invites/${inviteId}/resend`);
