import { fail, followUser, guard, unfollowUser } from "@/lib/socialServer";
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

/** POST /api/social/follow  { username } — seguir (perfil privado vira pedido). */
export async function POST(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-follow:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => followUser(supabaseAdmin(), user, (await body(request)).username)));
}

/** DELETE /api/social/follow?username=...  (ou { username } no corpo) — deixar de seguir / cancelar o pedido. */
export async function DELETE(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-follow:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  const username = new URL(request.url).searchParams.get("username") || (await body(request)).username;
  return send(await guard(async () => unfollowUser(supabaseAdmin(), user, username)));
}
