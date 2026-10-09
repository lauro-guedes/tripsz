import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/adjust-xp
 * body: { email: "admin@tripsz.com", userId: "UUID", adjustment: number, reason: string }
 *
 * O XP normal é sempre calculado ao vivo a partir dos jogos reais —
 * não existe uma coluna de XP pra somar direto. Esse ajuste fica
 * guardado separado (em user_metadata.xp_adjustment) e é somado por
 * cima do XP calculado, só nas telas do admin por enquanto.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, userId, adjustment, reason } = body;

    if (!(await requireAdmin(request))) {
      return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
    }
    if (!userId || adjustment === undefined || adjustment === null) {
      return Response.json({ error: "userId e adjustment são obrigatórios." }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return Response.json({ error: "Justificativa é obrigatória pra esse tipo de ajuste." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const currentAdjustment = userData.user.user_metadata?.xp_adjustment || 0;
    const newAdjustment = currentAdjustment + Number(adjustment);

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...userData.user.user_metadata,
        xp_adjustment: newAdjustment,
        xp_adjustment_reason: reason.trim(),
        xp_adjustment_by: email,
        xp_adjustment_at: new Date().toISOString(),
      },
    });
    if (updateError) throw updateError;

    return Response.json({ success: true, newAdjustment });
  } catch (e) {
    console.error("Erro em /api/admin/users/adjust-xp:", e);
    return Response.json({ error: e.message || "Não foi possível ajustar o XP." }, { status: 500 });
  }
}
