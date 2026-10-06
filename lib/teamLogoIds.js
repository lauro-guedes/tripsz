/**
 * Escudos de times: IDs fixos e o endereço do nosso storage.
 * Usado pelo componente TeamBadge (tela) — fonte única da lista.
 */
// IDs de time na API-Football, usados só para montar a URL do escudo no
// CDN público deles (media.api-sports.io/football/teams/{id}.png) — não
// precisa de chave de API pra isso, é só uma imagem estática. Times que
// não estão aqui (ou cujo ID estiver errado) caem automaticamente no
// fallback de iniciais dentro de <TeamBadge>, então nunca aparece um
// ícone quebrado na tela.
export const TEAM_LOGO_IDS = {
  Arsenal: 42, Chelsea: 49, Liverpool: 40, "Manchester City": 50, Tottenham: 47,
  "Real Madrid": 541, Barcelona: 529, "Atlético Madrid": 530, Sevilla: 536,
  "Bayern München": 157, "Borussia Dortmund": 165, PSG: 85, Marseille: 81,
  Porto: 212, Benfica: 211, Ajax: 194, Feyenoord: 209, PSV: 197,
  Galatasaray: 645, Fenerbahçe: 611, "Boca Juniors": 451, "River Plate": 435,
  Flamengo: 127, Fluminense: 124, Corinthians: 131, Palmeiras: 121,
  Inter: 505, Milan: 489, Napoli: 492, Roma: 497, Lazio: 487,
  "AZ Alkmaar": 201, Bologna: 500, "Colo-Colo": 2315, Millonarios: 1125,
  Nacional: 2356, Newcastle: 34, "Peñarol": 2348, "Santa Fe": 1139, "Universidad de Chile": 2323,
};

export const TEAM_LOGO_BUCKET = "https://aswxlrabhyzblyliyvjn.supabase.co/storage/v1/object/public/team-logos";
