import { deletePost, fail, guard, setPostVisibility } from "@/lib/socialServer";
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

/** DELETE /api/social/posts/<id> — apagar um post meu. */
export async function DELETE(request, { params }) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-post-del:${user.id}`, 30, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => deletePost(supabaseAdmin(), user, params.id)));
}

/** PATCH /api/social/posts/<id>  { visibility } — mudar quem pode ver um post meu. */
export async function PATCH(request, { params }) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-post-vis:${user.id}`, 30, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => setPostVisibility(supabaseAdmin(), user, params.id, (await body(request)).visibility)));
}
