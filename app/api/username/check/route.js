import { supabaseAdmin } from "@/lib/supabase";
import { normalizeUsername, suggestUsername, usernameError } from "@/lib/username";

/**
 * GET /api/username/check?u=nome.sobrenome[&first=Nome&last=Sobrenome]
 * Diz se o @ tem formato válido e se está livre. Se estiver ocupado, devolve uma sugestão livre.
 */
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const u = normalizeUsername(params.get("u"));
  const formatError = usernameError(u);
  if (formatError) return Response.json({ valid: false, available: false, reason: formatError });

  try {
    const supabase = supabaseAdmin();
    const isTaken = async (name) => {
      const { data, error } = await supabase.from("profiles").select("user_id").eq("username", name).maybeSingle();
      if (error) throw error;
      return !!data;
    };
    if (!(await isTaken(u))) return Response.json({ valid: true, available: true });

    // Ocupado: procura uma variação livre (nome.sobrenome + número).
    const base = (suggestUsername(params.get("first"), params.get("last")) || u).slice(0, 17);
    for (let i = 0; i < 12; i++) {
      const candidate = `${base}${Math.floor(Math.random() * 900) + 100}`;
      if (!usernameError(candidate) && !(await isTaken(candidate))) {
        return Response.json({ valid: true, available: false, reason: "Esse @ já está em uso.", suggestion: candidate });
      }
    }
    return Response.json({ valid: true, available: false, reason: "Esse @ já está em uso." });
  } catch (e) {
    // Tabela ainda não criada ou banco indisponível: não bloqueia o cadastro (o banco garante a unicidade).
    console.error("Erro em /api/username/check:", e?.message || e);
    return Response.json({ valid: true, available: true, unchecked: true });
  }
}
