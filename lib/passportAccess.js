"use client";
import { supabaseBrowser } from "./supabase";

/* --- Acesso ao Passport: Meu Nível, Minhas Conquistas e Registrar Jogo
   são de graça pra todo mundo. O que é pago (R$9,90/mês ou R$99,90/ano)
   é registrar mais de 20 jogos, e a importação em massa (Futbology).
   Usuários de antes do lançamento da assinatura ("legado") não têm
   nenhum desses limites. --- */
export const PASSPORT_LAUNCH_DATE = new Date("2026-09-25T00:00:00Z");

// E-mails com acesso completo liberado manualmente, sem precisar de
// assinatura — configurado na Vercel (NEXT_PUBLIC_FREE_ACCESS_EMAILS,
// separados por vírgula). De propósito não mexe na tabela de
// assinaturas, pra não distorcer os números de receita/MRR no painel
// administrativo.
export function isFreeAccessEmail(email) {
  const allowed = (process.env.NEXT_PUBLIC_FREE_ACCESS_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.toLowerCase());
}

// Limite de jogos pra quem não é assinante — Nível, Conquistas e
// Ranking já são de graça pra todo mundo; isso só limita QUANTOS jogos
// dá pra registrar sem assinar.
export const FREE_GAMES_LIMIT = 20;

export async function checkPassportAccess() {
  const supabase = supabaseBrowser();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return { hasAccess: false, isPaid: false, legacy: false, userId: null, userEmail: null, gamesCount: 0, gamesLimit: FREE_GAMES_LIMIT, canAddMoreGames: false };
  }

  let isPaid = false;
  let legacy = false;
  let freeAccess = false;
  let subscription = null;

  if (new Date(user.created_at) < PASSPORT_LAUNCH_DATE) {
    isPaid = true;
    legacy = true;
  } else if (isFreeAccessEmail(user.email)) {
    isPaid = true;
    freeAccess = true;
  } else {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) {
      isPaid = true;
      subscription = sub;
    }
  }

  const { count: gamesCount } = await supabase
    .from("attended_games")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  const gamesLimit = isPaid ? Infinity : FREE_GAMES_LIMIT;

  return {
    hasAccess: true, // o Passport em si (Nível/Conquistas/Ranking) agora é sempre de graça
    isPaid,
    legacy,
    freeAccess,
    subscription,
    userId: user.id,
    userEmail: user.email,
    gamesCount: gamesCount || 0,
    gamesLimit,
    canAddMoreGames: (gamesCount || 0) < gamesLimit,
  };
}
