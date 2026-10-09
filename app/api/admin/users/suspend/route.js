import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/suspend
 * body: { email: "admin@tripsz.com", userId: "UUID", suspend: true|false }
 *
 * Usa o recurso nativo do Supabase pra bloquear login (ban_duration) —
 * não apaga nada da conta, só impede entrar enquanto estiver suspensa.
 * Reativar é só zerar esse bloqueio de novo.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, userId, suspend } = body;

    if (!(await requireAdmin(request))) {
      return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
    }
    if (!userId || suspend === undefined) {
      return Response.json({ error: "userId e suspend são obrigatórios." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: suspend ? "87600h" : "none", // ~10 anos = suspenso até reativar, "none" = reativa
    });
    if (updateError) throw updateError;

    return Response.json({ success: true, suspended: suspend });
  } catch (e) {
    console.error("Erro em /api/admin/users/suspend:", e);
    return Response.json({ error: e.message || "Não foi possível alterar o status da conta." }, { status: 500 });
  }
}
