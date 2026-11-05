import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { liveGames } from "@/lib/liveScores";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

/** GET /api/live — jogos acontecendo agora nas ligas que o app acompanha (cache de 30 s no servidor). */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  if (!allow(`live:${user.id}`, 20, 60_000)) return Response.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  try {
    return Response.json({ ok: true, ...(await liveGames()) }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "server" }, { status: 502, headers: NO_STORE });
  }
}
