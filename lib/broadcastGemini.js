/**
 * Onde assistir — a conversa com o Gemini (busca do Google embutida). SÓ no servidor: a chave (GEMINI_API_KEY) nunca vai pro navegador
 * nem aparece em mensagem de erro.
 */
export const DEFAULT_MODEL = "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiError extends Error {
  constructor(kind, status) { super(`gemini:${kind}${status ? `:${status}` : ""}`); this.kind = kind; this.status = status || null; }
}

const brt = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");

/** O pedido. Os jogos vêm do NOSSO calendário (com o número de cada um), então a IA só responde sobre o que a gente perguntou. */
export function buildPrompt(games) {
  const lines = games.map((f) => `id ${f.fixture_id}: ${f.home_team} x ${f.away_team} — ${f.league_name}${f.league_country && f.league_country !== "World" ? ` (${f.league_country})` : ""} — ${brt(f.kickoff)} (Brasília)`);
  return [
    "Você ajuda um app de futebol. Use a busca do Google para descobrir ONDE ASSISTIR (canais de TV e streaming NO BRASIL) a cada jogo da lista.",
    "Regras:",
    "- Use só informação confirmada e atual (ge, site oficial da competição ou da CBF, site das emissoras).",
    "- Se não achar a transmissão confirmada de um jogo, NÃO inclua esse jogo. Nunca deduza nem chute.",
    "- Liste todos os canais do Brasil que transmitem. Se o canal passa só em algumas regiões, escreva a região em \"obs\" (ex.: \"SP e parte da rede\").",
    "- Responda SOMENTE com JSON, sem texto antes nem depois, neste formato: [{\"id\":123,\"canais\":[{\"nome\":\"Globo\",\"obs\":\"SP e parte da rede\"},{\"nome\":\"Premiere\"}]}]",
    "Jogos:",
    ...lines,
  ].join("\n");
}

/** Pergunta ao Gemini (com a busca do Google ligada). Devolve { text, sources: [{ title, uri }], queries, ms } ou lança GeminiError. */
export async function askGemini({ games, apiKey, model = DEFAULT_MODEL, fetchImpl = fetch, timeoutMs = 45000 }) {
  if (!apiKey) throw new GeminiError("no_key");
  const started = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: buildPrompt(games) }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } }),
      signal: ctl.signal,
    });
  } catch (e) {
    throw new GeminiError(e && e.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new GeminiError(res.status === 429 ? "quota" : res.status === 400 || res.status === 401 || res.status === 403 ? "auth" : "upstream", res.status);
  let data;
  try { data = await res.json(); } catch { throw new GeminiError("bad_response"); }
  const cand = data && data.candidates && data.candidates[0];
  if (!cand || (data.promptFeedback && data.promptFeedback.blockReason)) throw new GeminiError("blocked");
  const text = ((cand.content && cand.content.parts) || []).map((p) => (p && p.text) || "").join("");
  const meta = cand.groundingMetadata || {};
  return {
    text,
    sources: (meta.groundingChunks || []).map((c) => c && c.web).filter(Boolean).map((w) => ({ title: w.title || "", uri: w.uri || "" })),
    queries: meta.webSearchQueries || [],
    ms: Date.now() - started,
  };
}
