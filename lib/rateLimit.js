/**
 * Limite de pedidos por chave (pessoa ou IP) numa janela de tempo — SÓ no servidor.
 *
 * Guarda na memória da instância do servidor: num serverless cada instância conta a sua parte, então é um
 * freio contra abuso e automação simples, não uma garantia exata. Para algo mais rígido, usar o banco.
 */
const buckets = new Map(); // chave -> [timestamps]

/** true = pode passar; false = estourou o limite (e este pedido NÃO conta). */
export function allow(key, limit, windowMs, now = Date.now()) {
  const list = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    buckets.set(key, list);
    return false;
  }
  list.push(now);
  buckets.set(key, list);
  // limpeza ocasional pra não crescer sem fim
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return true;
}

/** IP de quem chamou (a Vercel manda no x-forwarded-for). */
export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

/**
 * Freio para rotas públicas que gastam a cota da API-Football ou da Wikipedia.
 * Devolve uma resposta 429 pronta quando o IP estourou o limite na última janela, ou null se pode seguir.
 */
export function tooManyRequests(request, name, limit, windowMs = 60_000) {
  if (allow(`${name}:${clientIp(request)}`, limit, windowMs)) return null;
  return Response.json({ error: "Muitas buscas em pouco tempo. Espere um minuto e tente de novo." }, { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) } });
}

/** Só pros testes. */
export function _resetRateLimit() {
  buckets.clear();
}
