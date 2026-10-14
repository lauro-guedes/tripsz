import { fail, redeemInvite } from "@/lib/inviteServer";
import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const send = (r) => (r.error ? Response.json({ error: r.error, message: r.message }, { status: r.status, headers: NO_STORE }) : Response.json(r, { headers: NO_STORE }));

/**
 * POST /api/invites/<código>/redeem  — resgata o convite pra pessoa LOGADA (o jogo entra no Passaporte dela).
 * O convite é achado pelo código; o e-mail da pessoa não entra na conta. Pode repetir: o resultado é o mesmo.
 */
export async function POST(request, { params }) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`invite-redeem:${user.id}`, 20, 60_000)) return send(fail("rate_limited"));
  return send(await redeemInvite(supabaseAdmin(), { code: params.ref, user }));
}
