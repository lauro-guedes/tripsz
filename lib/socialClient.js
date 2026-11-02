"use client";
/**
 * Chamadas do navegador à API da rede social. Nunca lançam: devolvem { ok: true, ... } ou
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
const json = (method, url, body) => call(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
const q = encodeURIComponent;

export const getMyProfile = () => call("/api/social/me");
export const saveMyProfile = (patch) => json("PUT", "/api/social/me", patch);
export const getProfile = (username) => call(`/api/social/profiles/${q(username)}`);
export const followUser = (username) => json("POST", "/api/social/follow", { username });
export const unfollowUser = (username) => call(`/api/social/follow?username=${q(username)}`, { method: "DELETE" });
export const listFriends = (tab, offset = 0) => call(`/api/social/friends?tab=${q(tab)}&offset=${offset}`);
export const answerRequest = (username, action) => json("POST", "/api/social/requests", { username, action });
export const blockUser = (username) => json("POST", "/api/social/block", { username });
export const unblockUser = (username) => call(`/api/social/block?username=${q(username)}`, { method: "DELETE" });
export const listBlocked = () => call("/api/social/block");
export const reportProfile = (username, reason, details) => json("POST", "/api/social/report", { targetType: "profile", targetId: username, reason, details });

/** Troca o @ (endpoint que já existia: a resposta de erro vem em `error`). */
export async function updateUsername(username) {
  try {
    const res = await authFetch("/api/username/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, username: body.username };
    return { ok: false, message: body.error || "Não foi possível trocar o @. Tente novamente." };
  } catch {
    return { ok: false, message: "Sem conexão. Verifique a internet e tente de novo." };
  }
}
