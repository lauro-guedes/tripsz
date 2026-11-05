import { requireAdmin } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { pickTestGames, runRefresh } from "@/lib/broadcastJob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => Response.json(body, { status, headers: NO_STORE });

/**
 * Teste do admin: GET /api/admin/broadcasts-test?scope=brasil|europa&days=2&save=0|1
 * Pergunta ao Gemini os próximos jogos da faixa (uma leva) e mostra TUDO: o pedido, a resposta crua, as fontes, o que foi aceito e por que cada
 * recusado foi recusado. Com save=1 guarda o que passou na validação; sem isso, só mostra.
 */
export async function GET(request) {
  if (!(await requireAdmin(request))) return json({ error: "Acesso não autorizado." }, 403);
  const q = new URL(request.url).searchParams;
  const scope = q.get("scope") === "europa" ? "europa" : "brasil";
  try {
    const supabase = supabaseAdmin();
    const ids = await pickTestGames(supabase, { scope, days: Number(q.get("days")) || 2 });
    if (ids.length === 0) return json({ ok: true, none: true, message: "Nenhum jogo dessa faixa nos próximos dias." });
    const r = await runRefresh(supabase, { ids, apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || undefined, force: true, admin: true, dryRun: q.get("save") !== "1" });
    return json(r);
  } catch {
    return json({ error: "Não foi possível concluir agora." }, 500);
  }
}
