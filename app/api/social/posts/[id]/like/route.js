import { fail, guard, likePost, unlikePost } from "@/lib/socialServer";
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

/** POST /api/social/posts/<id>/like — curtir. */
export async function POST(request, { params }) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-like:${user.id}`, 120, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => likePost(supabaseAdmin(), user, params.id)));
}

/** DELETE /api/social/posts/<id>/like — descurtir. */
export async function DELETE(request, { params }) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-like:${user.id}`, 120, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => unlikePost(supabaseAdmin(), user, params.id)));
}
