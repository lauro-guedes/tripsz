import { fail, resendInvite } from "@/lib/inviteServer";
import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const send = (r) => (r.error ? Response.json({ error: r.error, message: r.message }, { status: r.status, headers: NO_STORE }) : Response.json(r, { headers: NO_STORE }));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/invites/<id do convite>/resend  — "Reenviar convite": cria um link novo e INVALIDA o anterior.
 * Só quem criou o convite pode reenviar. (Aqui o parâmetro é o ID do convite, não o código.)
 */
export async function POST(request, { params }) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`invite-resend:${user.id}`, 10, 60_000)) return send(fail("rate_limited"));
  if (!UUID.test(params.ref || "")) return send(fail("not_found"));
  return send(await resendInvite(supabaseAdmin(), { user, inviteId: params.ref, siteUrl: process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin }));
}
