"use client";
/**
 * Conquistas desbloqueadas — detecção de "acabou de desbloquear".
 *
 * As conquistas são CALCULADAS a partir dos jogos (não existe um evento de
 * desbloqueio no banco). Então guardamos, por pessoa e por aparelho, a lista
 * das que já foram vistas; o que aparecer a mais é novo. Na primeira vez que
 * o aparelho vê a pessoa, tudo que ela já tem entra na lista em silêncio
 * (senão quem já tem 20 conquistas levaria 20 telas de uma vez).
 */
import { computeBadgeCategories } from "../components/conta/MinhasConquistas";
import { countryKey } from "./countries";
import { dateOnly } from "./dateOnly";

const seenKey = (userId) => `tripsz:ach-seen:${userId}`;
const readSeen = (userId) => {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch { return null; }
};
const writeSeen = (userId, set) => {
  try { localStorage.setItem(seenKey(userId), JSON.stringify([...set])); } catch { /* sem storage */ }
};

/** Mesmos dados que a tela Minhas Conquistas usa pra calcular os selos. */
async function loadCtx(supabase, user) {
  const [{ data: attendedRows }, { data: activeSub }, { data: publicProfileRow }] = await Promise.all([
    supabase.from("attended_games").select("*").order("match_date", { ascending: false }),
    supabase.from("subscriptions").select("id").eq("status", "active").maybeSingle(),
    supabase.from("public_profiles").select("slug").eq("user_id", user.id).maybeSingle(),
  ]);
  const attended = attendedRows || [];
  const allGames = attended.map((g) => ({ date: dateOnly(g.match_date), stadium: g.stadium, city: g.city, country: g.country, competition: g.competition, home: g.home_team, away: g.away_team, source: g.source }));
  return {
    allGames,
    stadiumsSet: new Set(allGames.map((g) => g.stadium).filter(Boolean)),
    countriesSet: new Set(allGames.map((g) => countryKey(g.country)).filter(Boolean)),
    favoriteTeamsSet: new Set(user.user_metadata?.favorite_teams || []),
    hasPublicProfile: !!publicProfileRow,
    isSubscriber: !!activeSub,
    manualCount: attended.filter((g) => g.source === "manual").length,
    apiCount: attended.filter((g) => g.source === "api").length,
    userCreatedAt: user.created_at ? new Date(user.created_at) : null,
  };
}

/** Qual ícone representa o selo (mesma regra da tela de conquistas). */
export function badgeKind(category, label) {
  if (category === "Estádios & Geografia") return /país|continente/i.test(label) ? "globe" : "stadium";
  if (category === "Competições") return "trophy";
  return "award";
}

/**
 * Devolve as conquistas NOVAS (lista vazia se não há). Guarda tudo como visto.
 * [{ id, label, category, kind, name }]
 */
export async function checkNewAchievements(supabase) {
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;
  if (!user) return [];
  const ctx = await loadCtx(supabase, user);
  const unlocked = [];
  for (const cat of computeBadgeCategories(ctx)) {
    for (const b of cat.badges) if (b.unlocked) unlocked.push({ id: b.id, label: b.label, category: cat.title, kind: badgeKind(cat.title, b.label) });
  }
  const seen = readSeen(user.id);
  const name = String(user.user_metadata?.name || user.user_metadata?.full_name || "").trim().split(/\s+/)[0] || "";
  if (!seen) {
    writeSeen(user.id, new Set(unlocked.map((b) => b.id))); // primeira vez neste aparelho: tudo em silêncio
    return [];
  }
  const fresh = unlocked.filter((b) => !seen.has(b.id));
  if (fresh.length) {
    for (const b of fresh) seen.add(b.id);
    writeSeen(user.id, seen);
  }
  return fresh.map((b) => ({ ...b, name }));
}
