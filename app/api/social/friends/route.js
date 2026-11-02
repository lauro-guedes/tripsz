import { fail, guard, listFriends } from "@/lib/socialServer";
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

/** GET /api/social/friends?tab=amigos|seguidores|seguindo|solicitacoes&offset=0 — as listas da tela Amigos (só as MINHAS). */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-friends:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  const p = new URL(request.url).searchParams;
  return send(await guard(async () => listFriends(supabaseAdmin(), user, p.get("tab") || "amigos", { offset: p.get("offset") })));
}
