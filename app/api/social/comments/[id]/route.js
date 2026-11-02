import { deleteComment, fail, guard } from "@/lib/socialServer";
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

/** DELETE /api/social/comments/<id> — apagar um comentário (de quem escreveu ou do dono do post). */
export async function DELETE(request, { params }) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-comment-del:${user.id}`, 30, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => deleteComment(supabaseAdmin(), user, params.id)));
}
