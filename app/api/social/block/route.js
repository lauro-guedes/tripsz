import { blockUser, fail, guard, listBlocks, unblockUser } from "@/lib/socialServer";
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

/** GET /api/social/block — quem eu bloqueei. */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-block:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => listBlocks(supabaseAdmin(), user)));
}

/** POST /api/social/block  { username } — bloquear. */
export async function POST(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-block:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => blockUser(supabaseAdmin(), user, (await body(request)).username)));
}

/** DELETE /api/social/block?username=...  (ou { username } no corpo) — desbloquear. */
export async function DELETE(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-block:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  const username = new URL(request.url).searchParams.get("username") || (await body(request)).username;
  return send(await guard(async () => unblockUser(supabaseAdmin(), user, username)));
}
