import { fail, getTodayCheckins, guard } from "@/lib/socialServer";
import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const send = (r) => (r.error ? Response.json({ error: r.error, message: r.message }, { status: r.status, headers: NO_STORE }) : Response.json(r, { headers: NO_STORE }));
const body = async (request) => {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
};

/** GET /api/social/checkins/today — "Mais check-ins hoje": os jogos com mais check-ins públicos nas últimas 24 h (só contagens). */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-today:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  const p = new URL(request.url).searchParams;
  return send(await guard(async () => getTodayCheckins(supabaseAdmin())));
}
