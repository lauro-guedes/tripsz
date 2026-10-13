import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeUsername, usernameError } from "@/lib/username";

/**
 * POST /api/username/update  { username }
 * Troca o @ da pessoa logada. A unicidade é garantida pelo índice único do banco
 * (duas trocas simultâneas para o mesmo @ nunca passam as duas).
 * Se o link público dela era o @ antigo, o link passa a ser o novo @.
 */
export async function POST(request) {
  try {
    const user = await authUser(request);
    if (!user) return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
    const { username: raw } = await request.json();
    const username = normalizeUsername(raw);
    const formatError = usernameError(username);
    if (formatError) return Response.json({ error: formatError }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data: current } = await supabase.from("profiles").select("username").eq("user_id", user.id).maybeSingle();
    if (current?.username === username) return Response.json({ username });

    const { error } = current
      ? await supabase.from("profiles").update({ username, updated_at: new Date().toISOString() }).eq("user_id", user.id)
      : await supabase.from("profiles").insert({ user_id: user.id, username });
    if (error) {
      if (error.code === "23505") return Response.json({ error: "Esse @ já está em uso." }, { status: 409 });
      throw error;
    }

    if (current?.username) {
      await supabase.from("public_profiles").update({ slug: username }).eq("user_id", user.id).eq("slug", current.username);
    }
    return Response.json({ username });
  } catch (e) {
    console.error("Erro em /api/username/update:", e);
    return Response.json({ error: "Não foi possível trocar o @. Tente novamente." }, { status: 500 });
  }
}
