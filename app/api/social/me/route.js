import { fail, getMyProfile, guard, updateMyProfile } from "@/lib/socialServer";
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

/** GET /api/social/me — o meu perfil social (dados editáveis, se já fez o onboarding e os números). */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-me:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => getMyProfile(supabaseAdmin(), user)));
}

/** PUT /api/social/me  { displayName?, bio?, coverUrl?, avatarUrl?, kinds?, city?, country?, isPrivate?, onboarded? } — só mexe no que vier. */
export async function PUT(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-me-put:${user.id}`, 20, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => updateMyProfile(supabaseAdmin(), user, await body(request), { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL })));
}
