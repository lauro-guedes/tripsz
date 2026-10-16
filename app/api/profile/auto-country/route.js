import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { countryFromRequest } from "@/lib/ipCountry";
import { tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/profile/auto-country
 * Preenche o país da pessoa pelo país da conexão, SÓ se o campo ainda estiver vazio (nunca sobrescreve o que ela
 * escolheu). Roda uma vez por sessão: cobre quem acabou de criar a conta e quem já tinha conta sem país.
 */
export async function POST(request) {
  const limited = tooManyRequests(request, "auto-country", 20);
  if (limited) return limited;
  const user = await authUser(request);
  if (!user) return Response.json({ error: "Faça login." }, { status: 401 });

  const current = user.user_metadata || {};
  if (String(current.country || "").trim()) return Response.json({ set: false, country: current.country });

  const country = countryFromRequest(request);
  if (!country) return Response.json({ set: false, country: null });

  const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, {
    user_metadata: { ...current, country, country_source: "ip" },
  });
  if (error) {
    console.error("Erro em /api/profile/auto-country:", error.message);
    return Response.json({ set: false, country: null });
  }
  return Response.json({ set: true, country });
}
