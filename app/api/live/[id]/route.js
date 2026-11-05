import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { getFixtureDetails } from "@/lib/gameDetails";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

/** GET /api/live/<id do jogo> — placar, relógio, acontecimentos, escalações e estatísticas (cache de 20 s no servidor enquanto o jogo não termina). */
export async function GET(request, { params }) {
  const user = await authUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "bad_id" }, { status: 400, headers: NO_STORE });
  if (!allow(`live-one:${user.id}`, 30, 60_000)) return Response.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  try {
    const got = await getFixtureDetails(supabaseAdmin(), id);
    if (got.error) return Response.json({ error: got.error }, { status: got.error === "not-found" ? 404 : 502, headers: NO_STORE });
    return Response.json({ ok: true, details: got.details }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "server" }, { status: 500, headers: NO_STORE });
  }
}
