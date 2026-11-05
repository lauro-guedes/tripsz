"use client";
import { useEffect, useReducer } from "react";
import { authFetch } from "./authFetch";

/**
 * Onde assistir no app: junta os pedidos de vários cartões num só (/api/broadcasts?ids=...), guarda por 5 min e, se o servidor disser que
 * algum jogo está velho, pede UMA atualização (/api/broadcasts/refresh) em segundo plano e atualiza os cartões quando chegar.
 */
const TTL = 5 * 60 * 1000;
// Atualização automática pelo Gemini: DESLIGADA enquanto não houver cota/cobrança. Os canais confirmados são gravados à mão (tabela fixture_broadcasts).
const AUTO_REFRESH = false;
const cache = new Map(); // id -> { at, data: { channels, confirmedAt } | null, covered }
const subs = new Map(); // id -> Set<() => void>
const refreshed = new Set(); // já pedimos atualização desses nesta sessão (não repete)
let queue = new Set();
let timer = null;
let refreshing = false;

const notify = (id) => (subs.get(id) || new Set()).forEach((fn) => fn());
export const peek = (id) => cache.get(id) || null;
export function subscribe(id, fn) {
  if (!subs.has(id)) subs.set(id, new Set());
  subs.get(id).add(fn);
  return () => subs.get(id) && subs.get(id).delete(fn);
}
export function request(id) {
  const c = cache.get(id);
  if (c && Date.now() - c.at < TTL) return;
  queue.add(id);
  if (!timer) timer = setTimeout(flush, 60);
}

async function getJson(url, init) {
  try {
    const res = await authFetch(url, init);
    const body = await res.json().catch(() => ({}));
    return res.ok ? body : null;
  } catch {
    return null;
  }
}

async function flush() {
  timer = null;
  const ids = [...queue].slice(0, 60);
  queue = new Set([...queue].slice(60));
  if (queue.size) timer = setTimeout(flush, 60);
  const r = await getJson(`/api/broadcasts?ids=${ids.join(",")}`);
  const now = Date.now();
  for (const id of ids) {
    // falhou: tenta de novo em ~30 s e, enquanto isso, o cartão não mostra nada (nunca um canal inventado)
    cache.set(id, r ? { at: now, data: (r.items && r.items[id]) || null, covered: (r.covered || []).includes(id), likely: (r.likely && r.likely[id]) || null } : { at: now - TTL + 30_000, data: null, covered: false, likely: null });
    notify(id);
  }
  if (AUTO_REFRESH && r && r.stale && r.stale.length) refresh(r.stale.filter((id) => !refreshed.has(id)));
}

async function refresh(ids) {
  if (!ids.length || refreshing) return;
  ids.forEach((id) => refreshed.add(id));
  refreshing = true;
  const r = await getJson("/api/broadcasts/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
  refreshing = false;
  if (r && r.items) {
    const now = Date.now();
    for (const [k, v] of Object.entries(r.items)) {
      const id = Number(k);
      cache.set(id, { at: now, data: v, covered: true, likely: null });
      notify(id);
    }
  }
  if (r && r.busy) setTimeout(() => ids.forEach((id) => { refreshed.delete(id); cache.delete(id); request(id); }), 20_000); // outra pessoa já está atualizando: olha de novo daqui a pouco
}

/** Só pros testes. */
export function _reset() { cache.clear(); subs.clear(); refreshed.clear(); queue = new Set(); clearTimeout(timer); timer = null; refreshing = false; }

/** { ready, data, covered } do jogo `id` (null = não pedir). */
export function useBroadcast(id) {
  const [, rerender] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (id == null) return undefined;
    const off = subscribe(id, rerender);
    request(id);
    return off;
  }, [id]);
  const c = id == null ? null : peek(id);
  return { ready: !!c, data: c ? c.data : null, covered: !!(c && c.covered), likely: c ? c.likely : null };
}
