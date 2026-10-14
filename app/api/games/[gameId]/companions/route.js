import { fail, tagCompanions } from "@/lib/companionServer";
import { allow } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const send = (r) => (r.error ? Response.json({ error: r.error, message: r.message }, { status: r.status, headers: NO_STORE }) : Response.json(r, { headers: NO_STORE }));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/games/<id do jogo>/companions  { usernames: ["ana.santos", ...] }
 * Marca amigos (por @) num jogo DA PESSOA. Cada um recebe um AVISO pra aceitar; nada entra na conta dele sozinho.
 */
export async function POST(request, { params }) {
  const user = await authUser(request);
  if (!user) return send(fail("unauthorized"));
  if (!allow(`companions-tag:${user.id}`, 10, 60_000)) return send(fail("rate_limited"));
  if (!UUID.test(params.gameId || "")) return send(fail("game_not_found"));
  let body = {};
  try {
    body = await request.json();
  } catch {
    // corpo vazio: cai na validação
  }
  return send(await tagCompanions(supabaseAdmin(), { user, gameId: params.gameId, usernames: body.usernames }));
}
