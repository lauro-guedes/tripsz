/**
 * Regras de XP do Football Passport — fonte única do CÁLCULO (puro, roda no
 * navegador e no servidor).
 *
 *   XP = jogos × 50 + estádios diferentes × 100 + países diferentes × 200
 *        + conquistas × 150   (as 3 que contam: 5 estádios, 3 países, Champions League)
 *
 * Além do total, `xpBreakdown` diz quanto XP CADA jogo gerou, na ordem em que
 * os jogos aconteceram: o jogo vale 50; mais 100 se foi o primeiro naquele
 * estádio; mais 200 se foi o primeiro naquele país; mais 150 por cada
 * conquista que ele desbloqueou. A soma de todos os jogos é SEMPRE igual ao
 * total da fórmula acima.
 */
import { countryKey } from "./countries";

export const XP = { game: 50, stadium: 100, country: 200, achievement: 150 };

const dateOf = (g) => String(g.match_date || g.date || "");
const byTime = (a, b) =>
  dateOf(a).localeCompare(dateOf(b)) ||
  String(a.created_at || "").localeCompare(String(b.created_at || "")) ||
  String(a.id ?? "").localeCompare(String(b.id ?? ""));

const isChampions = (g) => /champions league/i.test(g.competition || "");

/**
 * @param games jogos registrados (linhas de attended_games: id, match_date, stadium, country, competition...)
 * @returns { byId: Map(id -> { total, parts: [{ key, label, xp }] }), total }
 */
export function xpBreakdown(games) {
  const stadiums = new Set();
  const countries = new Set();
  let hasChampions = false;
  let stadiumsDone = false;
  let countriesDone = false;
  let championsDone = false;
  const byId = new Map();
  let total = 0;

  for (const g of [...(games || [])].sort(byTime)) {
    const parts = [{ key: "game", label: "Jogo", xp: XP.game }];

    if (g.stadium && !stadiums.has(g.stadium)) {
      stadiums.add(g.stadium);
      parts.push({ key: "stadium", label: "Estádio novo", xp: XP.stadium });
    }
    const country = countryKey(g.country);
    if (country && !countries.has(country)) {
      countries.add(country);
      parts.push({ key: "country", label: "País novo", xp: XP.country });
    }
    if (isChampions(g)) hasChampions = true;

    // Conquistas que contam pro XP — o jogo que faz a condição ficar verdadeira leva o bônus.
    if (!stadiumsDone && stadiums.size >= 5) {
      stadiumsDone = true;
      parts.push({ key: "achievement-stadiums", label: "Conquista: 5 estádios", xp: XP.achievement });
    }
    if (!countriesDone && countries.size >= 3) {
      countriesDone = true;
      parts.push({ key: "achievement-countries", label: "Conquista: 3 países", xp: XP.achievement });
    }
    if (!championsDone && hasChampions) {
      championsDone = true;
      parts.push({ key: "achievement-champions", label: "Conquista: Champions League", xp: XP.achievement });
    }

    const sum = parts.reduce((acc, p) => acc + p.xp, 0);
    byId.set(g.id, { total: sum, parts });
    total += sum;
  }
  return { byId, total };
}

/** XP total (a mesma fórmula de sempre). */
export function totalXp(games) {
  return xpBreakdown(games).total;
}
