/**
 * Conquistas de torneios de seleções — fonte única, usada pelo Football Passport
 * (components/TripszApp.jsx) e pelo perfil público (app/api/public-profile).
 *
 * Só vale a COMPETIÇÃO PRINCIPAL: jogos de eliminatórias/qualificatórias,
 * de base (sub-20, sub-21...), olímpicos, futsal etc. NÃO contam. Por isso
 * "World Cup - Qualification South America" não desbloqueia "Copa do Mundo".
 * Os nomes vêm da API-Football (em inglês) ou digitados à mão (em português).
 */
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// qualquer um destes no nome tira o jogo da conta (não é a competição principal)
const NOT_MAIN_COMPETITION = /qualif|eliminat|\bu-?\d{2}\b|sub-?\d{2}|youth|juvenil|olimp|futsal|beach/;

export const TOURNAMENTS = [
  { id: "worldcup", label: "Copa do Mundo", include: /world cup|copa do mundo/, exclude: /club|clubes/ },
  { id: "copaamerica", label: "Copa América", include: /copa america/ },
  { id: "eurocopa", label: "Eurocopa", include: /\beuro championship\b|eurocopa|\buefa euro\b/ },
  { id: "nationsleague", label: "UEFA Nations League", include: /uefa nations league|liga das nacoes/ },
  { id: "copaouro", label: "Copa Ouro da CONCACAF", include: /gold cup|copa ouro/ },
  { id: "can", label: "Campeonato Africano das Nações", include: /africa cup of nations|campeonato africano|copa africana|\bafcon\b/ },
  { id: "copaasia", label: "Copa da Ásia", include: /asian cup|copa da asia/ },
  { id: "ofc", label: "Copa das Nações da OFC", include: /ofc nations cup|copa das nacoes da ofc/ },
];

/** Esse nome de competição é a edição principal do torneio `id`? */
export function isMainTournament(competition, id) {
  const t = TOURNAMENTS.find((x) => x.id === id);
  const c = norm(competition);
  if (!t || !c) return false;
  return t.include.test(c) && !(t.exclude && t.exclude.test(c)) && !NOT_MAIN_COMPETITION.test(c);
}

/** A pessoa foi a algum jogo da edição principal do torneio `id`? */
export function hasMainTournament(games, id) {
  return games.some((g) => isMainTournament(g.competition, id));
}
