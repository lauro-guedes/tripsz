import { fail, guard, listStadiums } from "@/lib/socialServer";
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

/** GET /api/social/stadiums?scope=todos|visitados|nao_visitados&q=...&lat=..&lon=.. — a aba Estádios (distância, visitado, check-ins de hoje, amigos que já foram). */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`social-stadiums:${user.id}`, 30, 60_000)) return send(fail("rate_limited"));
  const p = new URL(request.url).searchParams;
  return send(await guard(async () => listStadiums(supabaseAdmin(), user, { scope: p.get("scope") || "todos", q: p.get("q") || "", lat: p.get("lat"), lon: p.get("lon") })));
}
