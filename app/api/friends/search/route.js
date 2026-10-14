import { fail, searchFriend } from "@/lib/companionServer";
import { SEARCH_PER_MINUTE } from "@/lib/companions";
import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const send = (r) => (r.error ? Response.json({ error: r.error, message: r.message }, { status: r.status, headers: NO_STORE }) : Response.json(r, { headers: NO_STORE }));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/friends/search?q=@ana.santos — busca pelo @ EXATO (mínimo 3 caracteres). Devolve no máximo uma pessoa
 * (@ e primeiro nome); nunca lista usuários. Limitada por pessoa por minuto.
 */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`friend-search:${user.id}`, SEARCH_PER_MINUTE, 60_000)) return send(fail("rate_limited"));
  return send(await searchFriend(supabaseAdmin(), { user, query: new URL(request.url).searchParams.get("q") || "" }));
}
