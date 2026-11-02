import { fail, getFeed, guard } from "@/lib/socialServer";
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

/** GET /api/social/feed?scope=seguindo|todos&kind=checkin&cursor=... (kind=checkin: só os check-ins das últimas 24 h) — a Home: "seguindo" = posts e check-ins de quem eu sigo e os meus; "todos" = posts públicos de qualquer pessoa e os meus. */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-feed:${user.id}`, 60, 60_000)) return send(fail("rate_limited"));
  return send(await guard(async () => getFeed(supabaseAdmin(), user, { cursor: new URL(request.url).searchParams.get("cursor"), scope: new URL(request.url).searchParams.get("scope") || "seguindo", kind: new URL(request.url).searchParams.get("kind") || null })));
}
