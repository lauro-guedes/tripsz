import { previewInvite } from "@/lib/inviteServer";
import { allow, clientIp } from "@/lib/rateLimit";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/invites/<código>  — a página pública do convite.
 * Não exige login: quem tem o link vê times, placar, estádio, data, o nome digitado e o primeiro nome + @ de
 * quem convidou. Se a pessoa estiver logada (cabeçalho Authorization), vem também `viewer` (é a dona? já resgatou?).
 */
export async function GET(request, { params }) {
  if (!allow(`invite-preview:${clientIp(request)}`, 60, 60_000)) {
    return Response.json({ error: "rate_limited", message: "Muitas tentativas. Aguarde um instante e tente de novo." }, { status: 429, headers: NO_STORE });
  }
  const viewer = await authUser(request); // opcional: sem login, segue como visitante
  const out = await previewInvite(supabaseAdmin(), { code: params.ref, viewer });
  return Response.json(out, { headers: { ...NO_STORE, "X-Robots-Tag": "noindex" } });
}
