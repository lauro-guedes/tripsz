import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { runRefresh } from "@/lib/broadcastJob";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // o Gemini com busca pode levar de 10 a 30 s
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * POST /api/broadcasts/refresh  { ids } — atualiza (uma leva de até 10 jogos) o que está velho. Qualquer pessoa logada pode pedir, mas só roda
 * se houver jogo velho, nenhuma outra rodada em andamento e o limite do dia não tiver estourado. A chave fica só aqui no servidor.
 */
export async function POST(request) {
  const user = await authUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  if (!allow(`bc-refresh:${user.id}`, 6, 60_000)) return Response.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  let body = {};
  try { body = await request.json(); } catch { /* corpo vazio */ }
  try {
    const r = await runRefresh(supabaseAdmin(), { ids: Array.isArray(body.ids) ? body.ids : [], apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || undefined });
    if (r.ok === false) return Response.json({ ok: false, error: "upstream" }, { status: 502, headers: NO_STORE }); // o motivo detalhado fica no registro
    return Response.json(r, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "server" }, { status: 500, headers: NO_STORE });
  }
}
