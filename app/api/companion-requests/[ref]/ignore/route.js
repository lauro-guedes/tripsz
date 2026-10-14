import { fail, respondToRequest } from "@/lib/companionServer";
import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const send = (r) => (r.error ? Response.json({ error: r.error, message: r.message }, { status: r.status, headers: NO_STORE }) : Response.json(r, { headers: NO_STORE }));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/companion-requests/<id do aviso>/ignore — "Ignorar": nada entra na conta e quem marcou não é avisado. */
export async function POST(request, { params }) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`requests-respond:${user.id}`, 20, 60_000)) return send(fail("rate_limited"));
  if (!UUID.test(params.ref || "")) return send(fail("not_found"));
  return send(await respondToRequest(supabaseAdmin(), { user, requestId: params.ref, action: "ignore" }));
}
