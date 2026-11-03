"use client";
import { countryKey } from "./countries";
import { dateOnly } from "./dateOnly";
import { supabaseBrowser } from "./supabase";

/**
 * O contexto que a conta dos selos (`computeBadgeCategories`, de components/conta/MinhasConquistas.jsx) precisa — montado igual à tela
 * Conquistas, só que sem os dados que só ela usa (roteiros, link público). Devolve null se não houver sessão.
 * Só jogos REGISTRADOS contam pros selos.
 */
export async function loadBadgeContext() {
  const supabase = supabaseBrowser();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData && userData.user;
  if (!user) return null;
  const { data: activeSub } = await supabase.from("subscriptions").select("id").eq("status", "active").maybeSingle();
  const { data: attendedRows } = await supabase.from("attended_games").select("*").order("match_date", { ascending: false });
  const attended = attendedRows || [];
  const allGames = attended.map((g) => ({ date: dateOnly(g.match_date), stadium: g.stadium, city: g.city, country: g.country, competition: g.competition, home: g.home_team, away: g.away_team, source: g.source }));
  const { data: publicProfileRow } = await supabase.from("public_profiles").select("slug").eq("user_id", user.id).maybeSingle();
  return {
    allGames,
    stadiumsSet: new Set(allGames.map((g) => g.stadium).filter(Boolean)),
    countriesSet: new Set(allGames.map((g) => countryKey(g.country)).filter(Boolean)),
    favoriteTeamsSet: new Set((user.user_metadata && user.user_metadata.favorite_teams) || []),
    hasPublicProfile: !!publicProfileRow,
    isSubscriber: !!activeSub,
    manualCount: attended.filter((g) => g.source === "manual").length,
    apiCount: attended.filter((g) => g.source === "api").length,
    userCreatedAt: user.created_at ? new Date(user.created_at) : null,
  };
}
