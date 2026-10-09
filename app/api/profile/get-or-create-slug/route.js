import { supabaseAdmin } from "@/lib/supabase";
import { authUser } from "@/lib/serverAuth";

function slugify(text) {
  return (text || "torcedor")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

/**
 * POST /api/profile/get-or-create-slug
 * Recebe { userId, name }. Se a pessoa já tem um slug público, devolve
 * o mesmo de sempre (o link não muda toda hora). Senão, gera um novo
 * (nome + sufixo aleatório) e salva.
 */
export async function POST(request) {
  try {
    const user = await authUser(request);
    if (!user) {
      return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
    }
    const userId = user.id; // vem do token conferido, nunca do corpo da requisição
    const { name } = await request.json();

    const supabase = supabaseAdmin();

    const { data: existing } = await supabase
      .from("public_profiles")
      .select("slug")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      return Response.json({ slug: existing.slug });
    }

    const base = slugify(name);
    let slug = null;
    // Tenta um sufixo aleatório algumas vezes, pro caso raro de colisão.
    for (let i = 0; i < 5 && !slug; i++) {
      const candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from("public_profiles").insert({ user_id: userId, slug: candidate });
      if (!error) slug = candidate;
    }
    if (!slug) {
      return Response.json({ error: "Não foi possível gerar o link. Tente de novo." }, { status: 500 });
    }

    return Response.json({ slug });
  } catch (e) {
    console.error("Erro em /api/profile/get-or-create-slug:", e);
    return Response.json({ error: e.message || "Não foi possível criar o link público." }, { status: 500 });
  }
}
