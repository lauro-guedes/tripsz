/**
 * Futebol feminino — regras PURAS (sem rede), usadas pela busca, pelas conquistas e pela exibição.
 *
 * A API-Football marca time feminino com " W" (ou " Women") no fim do nome ("Arsenal W", "Brazil W")
 * e o nome da competição costuma trazer "Women" ("World Cup - Women", "Super League Women"). Jogos digitados à mão
 * podem vir em português ("Corinthians Feminino", "Copa do Mundo Feminina"). Nada aqui depende do ID da liga.
 */
const norm = (s) => (typeof s === "string" ? s : "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// o nome TERMINA com isso, depois de um espaço ou traço: "arsenal w", "chelsea women", "corinthians - feminino"
const WOMEN_SUFFIX = /[\s-](w|women|feminino|feminina|femenino|femenina|feminine|feminin|frauen)$/;
const WOMEN_SUFFIX_CUT = /[\s-]+(w|women|feminino|feminina|femenino|femenina|feminine|feminin|frauen)$/; // roda no texto sem acento e minúsculo
// a competição diz que é feminina
const WOMEN_COMPETITION = /women|feminin|femenin|femminil|frauen|\bwsl\b|\bnwsl\b|w[- ]league|\bliga f\b/;

/** "Arsenal W", "Chelsea Women", "Corinthians - Feminino": time feminino? ("W Connection" e "Wolverhampton" não.) */
export const isWomenTeamName = (name) => WOMEN_SUFFIX.test(norm(name));

/** "World Cup - Women", "Super League Women", "NWSL", "Liga F": competição feminina? */
export const isWomenCompetition = (name) => WOMEN_COMPETITION.test(norm(name));

/**
 * Jogo feminino? Aceita o jogo do nosso banco (home_team/away_team/competition) ou o do Passaporte (home/away):
 * a competição é feminina OU um dos times é feminino.
 */
export function isWomenGame(g) {
  if (!g) return false;
  return isWomenCompetition(g.competition) || isWomenTeamName(g.home ?? g.home_team) || isWomenTeamName(g.away ?? g.away_team);
}

/**
 * "Arsenal Feminino" / "Arsenal W" / "Arsenal - Feminino" -> { base: "Arsenal", women: true }. "Arsenal" -> { base: "Arsenal", women: false }.
 * Serve pra pessoa poder escrever do jeito que quiser e a busca falar com a API do jeito que ela entende ("Arsenal W").
 */
export function splitWomenName(raw) {
  const text = String(raw ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
  if (!isWomenTeamName(text)) return { base: text, women: false };
  // O corte é medido no texto sem acento ("Féminin" -> "feminin"), mas feito no original: o nome do clube mantém os acentos.
  const cut = norm(text).match(WOMEN_SUFFIX_CUT);
  return { base: cut ? text.slice(0, text.length - cut[0].length).trim() : text, women: true };
}

/** O nome que a API-Football espera pro time feminino de um clube. */
export const toApiWomenName = (base) => `${String(base ?? "").trim()} W`;
