import { fail, getUserProfile, guard } from "@/lib/socialServer";
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

/** GET /api/social/profiles/<@usuário> — o perfil de uma pessoa, do jeito que EU posso ver (privado, bloqueio, seguir). */
export async function GET(request, { params }) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-profile:${user.id}`, 120, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => getUserProfile(supabaseAdmin(), user, params.username)));
}
