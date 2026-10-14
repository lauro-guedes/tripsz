"use client";
// Foto real do estádio (Wikipedia, via /api/venues/photo). Cada estádio é buscado uma vez por
// visita ao site; o modal de detalhes já dispara a busca ao abrir, então quando a pessoa chega
// na aba Estádio a foto normalmente já está pronta.
const cache = new Map(); // chave -> Promise<{ url } | null>
const resolved = new Map(); // chave -> { url } | null (já resolvido)

const keyOf = (name, city) => `${name || ""}|${city || ""}`;

export function peekVenuePhoto(name, city) {
  const k = keyOf(name, city);
  return resolved.has(k) ? { done: true, value: resolved.get(k) } : { done: false, value: null };
}

export function getVenuePhoto(name, city) {
  if (!name) return Promise.resolve(null);
  const k = keyOf(name, city);
  if (!cache.has(k)) {
    const p = fetch(`/api/venues/photo?name=${encodeURIComponent(name)}&city=${encodeURIComponent(city || "")}`)
      .then((r) => r.json())
      .then((j) => (j && j.url ? { url: j.url } : null))
      .catch(() => {
        cache.delete(k); // erro de rede: deixa tentar de novo depois
        return null;
      })
      .then((val) => {
        if (cache.has(k)) resolved.set(k, val);
        return val;
      });
    cache.set(k, p);
  }
  return cache.get(k);
}
