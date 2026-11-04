import { fail, guard, searchPeople, suggestPeople } from "@/lib/socialServer";
import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const send = (r) => (r.error ? Response.json({ error: r.error, message: r.message }, { status: r.status, headers: NO_STORE }) : Response.json(r, { headers: NO_STORE }));

/** GET /api/social/discover?q=... — busca por nome ou @ (q com 2+ letras); sem q, as sugestões (amigos em comum e estádios em comum). */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-discover:${user.id}`, 40, 60_000)) return send(fail("rate_limited"));
  const q = new URL(request.url).searchParams.get("q") || "";
  return send(await guard(async () => (q.trim() ? searchPeople(supabaseAdmin(), user, q) : suggestPeople(supabaseAdmin(), user))));
}
