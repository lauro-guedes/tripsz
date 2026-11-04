import { fail, guard, listNotifications, markNotificationsSeen } from "@/lib/socialServer";
import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const send = (r) => (r.error ? Response.json({ error: r.error, message: r.message }, { status: r.status, headers: NO_STORE }) : Response.json(r, { headers: NO_STORE }));

/** GET /api/social/notifications — novos seguidores, pedidos, curtidas e comentários (últimos 30 dias) e quantos não vi. */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-notifs:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => listNotifications(supabaseAdmin(), user)));
}

/** POST /api/social/notifications { action: "seen" } — marca tudo como visto. */
export async function POST(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-notifs-seen:${user.id}`, 30, 60_000)) return send(fail("rate_limited"));
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  if (!body || body.action !== "seen") return send(fail("invalid_field"));
  return send(await guard(async () => markNotificationsSeen(supabaseAdmin(), user)));
}
