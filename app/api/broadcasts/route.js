import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { readBroadcasts } from "@/lib/broadcastJob";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/broadcasts?ids=1,2,3 — onde assistir (o que está guardado) dos jogos pedidos. Não chama o Gemini.
 * Devolve { items: { [id]: { channels, confirmedAt } }, covered: [ids que a gente cobre], stale: [ids que valem uma atualização] }.
 */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  if (!allow(`bc-get:${user.id}`, 60, 60_000)) return Response.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  try {
    const ids = String(new URL(request.url).searchParams.get("ids") || "").split(",").slice(0, 60);
    return Response.json({ ok: true, ...(await readBroadcasts(supabaseAdmin(), ids)) }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "server" }, { status: 500, headers: NO_STORE });
  }
}
