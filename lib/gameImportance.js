/**
 * "Jogo principal": quanto um jogo pesa na escolha do roteiro quando a pessoa NÃO
 * indicou favoritos (e como desempate quando indicou). Soma de três coisas:
 *   1) a competição — internacional > primeira divisão > copa nacional > segunda divisão;
 *   2) a fase — final, semifinal, quartas...;
 *   3) os clubes — grandes clubes de cada país (os nomes são como a API grafa).
 * É só um peso: favoritos (100) continuam à frente de qualquer jogo "principal".
 */

/** Pontos pela competição (id da liga na API). Segunda divisão e afins: 0. */
const COMPETITION_POINTS = {
  // internacionais
  2: 9, // Champions League
  13: 9, // Libertadores
  3: 5, // Europa League
  11: 5, // Sul-Americana
  848: 3, // Conference League
  // primeira divisão
  39: 4, 140: 4, 135: 4, 78: 4, 61: 4, 94: 4, 88: 4, 203: 4, 71: 4, 128: 4, 268: 4, 265: 4, 239: 4,
  // copas nacionais
  45: 3, 143: 3, 137: 3, 81: 3, 66: 3, 96: 3, 73: 3, 48: 2,
};

/** Pontos pela fase do mata-mata. */
function stagePoints(round) {
  const r = String(round || "");
  if (/^final$/i.test(r)) return 6;
  if (/semi/i.test(r)) return 4;
  if (/quarter/i.test(r)) return 3;
  if (/round of 16|8th finals/i.test(r)) return 2;
  return 0;
}

const key = (name) => (name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Grandes clubes (nível 1) e clubes de peso (nível 2), com os nomes da API. */
const TIER1 = [
  // Inglaterra
  "Manchester United", "Manchester City", "Liverpool", "Arsenal", "Chelsea", "Tottenham",
  // Espanha
  "Real Madrid", "Barcelona", "Atletico Madrid",
  // Itália
  "Juventus", "Inter", "AC Milan", "Napoli", "AS Roma", "Lazio",
  // Alemanha
  "Bayern München", "Borussia Dortmund",
  // França
  "Paris Saint Germain", "Marseille", "Lyon",
  // Portugal
  "Benfica", "FC Porto", "Sporting CP",
  // Holanda
  "Ajax", "PSV Eindhoven", "Feyenoord",
  // Turquia
  "Galatasaray", "Fenerbahçe", "Beşiktaş",
  // Brasil
  "Flamengo", "Palmeiras", "Corinthians", "Sao Paulo", "Santos", "Gremio", "Internacional", "Atletico-MG", "Fluminense", "Vasco DA Gama", "Cruzeiro",
  // Argentina
  "Boca Juniors", "River Plate", "Independiente", "Racing Club", "San Lorenzo",
  // Uruguai
  "Penarol", "Club Nacional",
  // Chile
  "Colo Colo", "Universidad de Chile", "U. Catolica",
  // Colômbia
  "Atletico Nacional", "Millonarios",
].map(key);

const TIER2 = [
  // Inglaterra
  "Newcastle", "Aston Villa", "Everton", "Leeds", "Nottingham Forest", "West Ham",
  // Espanha
  "Sevilla", "Valencia", "Athletic Club", "Real Sociedad", "Villarreal", "Real Betis",
  // Itália
  "Atalanta", "Fiorentina", "Bologna", "Torino", "Genoa",
  // Alemanha
  "Bayer Leverkusen", "RB Leipzig", "Eintracht Frankfurt", "Borussia Mönchengladbach", "FC Schalke 04", "Werder Bremen", "VfB Stuttgart", "Hamburger SV", "Union Berlin",
  // França
  "Monaco", "Lille", "Lens", "Nice", "Rennes",
  // Portugal
  "SC Braga", "Vitória SC",
  // Holanda
  "AZ Alkmaar", "Twente", "Utrecht",
  // Turquia
  "Trabzonspor", "Başakşehir",
  // Brasil
  "Botafogo", "Bahia", "Atletico Paranaense", "Coritiba", "Vitoria",
  // Argentina
  "Estudiantes L.P.", "Velez Sarsfield", "Rosario Central", "Newells Old Boys", "Lanus", "Huracan", "Talleres Cordoba", "Gimnasia L.P.",
  // Uruguai
  "Defensor Sporting", "Danubio", "Wanderers",
  // Chile
  "Universidad de Concepcion", "Palestino",
  // Colômbia
  "America de Cali", "Junior", "Santa Fe", "Independiente Medellin", "Deportivo Cali",
].map(key);

const T1 = new Set(TIER1);
const T2 = new Set(TIER2);

/** 2 = grande clube, 1 = clube de peso, 0 = outro. */
export function clubTier(name) {
  const k = key(name);
  return T1.has(k) ? 2 : T2.has(k) ? 1 : 0;
}

/** Pontos pelos clubes: dois grandes = 5; um grande = 3; dois de peso = 2; um de peso = 1. */
function clubPoints(home, away) {
  const a = clubTier(home);
  const b = clubTier(away);
  if (a === 2 && b === 2) return 5;
  if (a === 2 || b === 2) return 3;
  if (a === 1 && b === 1) return 2;
  if (a === 1 || b === 1) return 1;
  return 0;
}

/** Importância do jogo (0 = jogo comum; ~20 = final de Champions entre gigantes). */
export function importanceOf(game) {
  const comp = game.competition || {};
  return (COMPETITION_POINTS[comp.id] || 0) + stagePoints(comp.round) + clubPoints(game.home && game.home.name, game.away && game.away.name);
}
