"use client";
import { notifyGamesChanged } from "./gamesEvents";
import { checkPassportAccess } from "./passportAccess";
import { supabaseBrowser } from "./supabase";

/**
 * Coloca no Passaporte o jogo de um check-in (o mesmo que o pop-up de GPS do app fazia), respeitando o limite de jogos do plano grátis.
 * `game`: um jogo de agora de /api/social/checkin/nearby; `stadium`: o estádio dele.
 * Devolve { ok: true, already, game } (`game` no formato do "Quem foi com você?") ou { ok: false, reason: "session" | "limit" | "error", limit? }.
 */
export async function registerCheckinGame({ game, stadium }) {
  try {
    const access = await checkPassportAccess();
    if (!access.userId) return { ok: false, reason: "session" };
    const supabase = supabaseBrowser();
    const draft = (id) => ({ id, source: "api", api_fixture_id: game.fixtureId, home_team: game.home, away_team: game.away, home_logo: game.homeLogo || null, away_logo: game.awayLogo || null, home_score: null, away_score: null, match_date: game.matchDate, stadium: stadium.name, city: stadium.city, country: stadium.country || "—", competition: game.competition });
    const { data: have } = await supabase.from("attended_games").select("id").eq("user_id", access.userId).eq("api_fixture_id", game.fixtureId).maybeSingle();
    if (have) return { ok: true, already: true, game: draft(have.id) }; // já estava no Passaporte: não duplica
    if (!access.canAddMoreGames) return { ok: false, reason: "limit", limit: access.gamesLimit };
    const { data, error } = await supabase.from("attended_games").insert({ user_id: access.userId, source: "api", api_fixture_id: game.fixtureId, home_team: game.home, away_team: game.away, home_logo: game.homeLogo || null, away_logo: game.awayLogo || null, match_date: game.matchDate, stadium: stadium.name, city: stadium.city, country: stadium.country || "—", competition: game.competition }).select("id").single();
    if (error || !data) return { ok: false, reason: "error" };
    try { localStorage.setItem(`tripsz:checkin:${game.fixtureId}`, "yes"); } catch { /* sem storage: o pop-up só pergunta de novo se o jogo não estiver no Passaporte */ }
    notifyGamesChanged();
    return { ok: true, already: false, game: draft(data.id) };
  } catch {
    return { ok: false, reason: "error" };
  }
}
