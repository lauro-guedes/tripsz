/**
 * Quem está chamando a API? — SÓ no servidor.
 *
 * O navegador manda o token de login do Supabase no cabeçalho
 * `Authorization: Bearer <token>` (ver lib/authFetch.js). Aqui o servidor
 * confirma esse token direto com o Supabase e descobre quem é a pessoa de
 * verdade. NUNCA confie num userId ou e-mail que veio no corpo/URL da
 * requisição: qualquer um pode digitar o que quiser ali.
 */
import { supabaseAdmin } from "@/lib/supabase";

/** Devolve o usuário logado (objeto do Supabase) ou null. */
export async function authUser(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/** O e-mail está na lista ADMIN_EMAILS (variável da Vercel)? */
export function isAdminEmail(email) {
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.toLowerCase());
}

/** Quem chamou é um administrador logado de verdade? Devolve o usuário ou null. */
export async function requireAdmin(request) {
  const user = await authUser(request);
  if (!user || (!user.email_confirmed_at && !user.confirmed_at)) return null;
  return isAdminEmail(user.email) ? user : null;
}
