import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/reset-password
 * body: { email: "admin@tripsz.com", userId: "UUID" }
 *
 * Dispara o mesmo e-mail de redefinição de senha que a pessoa receberia
 * se clicasse "Esqueci minha senha" sozinha — não muda nada direto na
 * conta, só envia o link.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, userId } = body;

    if (!(await requireAdmin(request))) {
      return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
    }
    if (!userId) {
      return Response.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tripsz.vercel.app";
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(userData.user.email, {
      redirectTo: `${siteUrl}/redefinir-senha`,
    });
    if (sendError) throw sendError;

    return Response.json({ success: true, email: userData.user.email });
  } catch (e) {
    console.error("Erro em /api/admin/users/reset-password:", e);
    return Response.json({ error: e.message || "Não foi possível enviar o e-mail de redefinição." }, { status: 500 });
  }
}
