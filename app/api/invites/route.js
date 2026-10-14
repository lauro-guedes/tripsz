import { createInvite, fail, listInvites } from "@/lib/inviteServer";
import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const send = (r) => (r.error ? Response.json({ error: r.error, message: r.message }, { status: r.status, headers: NO_STORE }) : Response.json(r, { headers: NO_STORE }));
const siteUrl = (request) => process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

/**
 * POST /api/invites  { gameId, inviteeName, channel: "whatsapp" | "email" | "link" }
 * Cria o convite de um jogo DA PESSOA e devolve o link (a única vez que o código existe em claro).
 * Não guarda telefone nem e-mail: só o nome que a pessoa digitou.
 */
export async function POST(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`invite-create:${user.id}`, 10, 60_000)) return send(fail("rate_limited"));
  let body = {};
  try {
    body = await request.json();
  } catch {
    // corpo vazio: cai nas validações
  }
  return send(await createInvite(supabaseAdmin(), { user, gameId: body.gameId, inviteeName: body.inviteeName, channel: body.channel, siteUrl: siteUrl(request) }));
}

/** GET /api/invites?gameId=...  — os convites que a pessoa criou pra esse jogo ("Seus convites"). */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`invite-list:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  return send(await listInvites(supabaseAdmin(), { user, gameId: new URL(request.url).searchParams.get("gameId") }));
}
