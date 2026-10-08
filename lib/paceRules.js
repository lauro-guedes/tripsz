/**
 * Regra de ritmo do roteiro — fonte única, usada pelo motor (lib/tripPlanner.js)
 * e pela tela de preferências, pra o texto que a pessoa lê ser a regra real.
 *
 * "Dias livres" = dias SEM jogo entre dois jogos. O motor exige, entre dois
 * jogos seguidos, pelo menos (dias livres + 1) dias de calendário — e mais que
 * isso quando a distância entre as cidades pede (ver travelMinDays).
 */
export const PACE_FREE_DAYS = { compact: 0, balanced: 1, spaced: 2, relaxed: 3 };

/** Intervalo mínimo, em dias, entre um jogo e o próximo naquele ritmo. */
export function paceMinGapDays(pace) {
  return (PACE_FREE_DAYS[pace] ?? PACE_FREE_DAYS.spaced) + 1;
}

/**
 * Texto do cartão de ritmo: "jogos a cada X-Y dias". X é o intervalo mínimo
 * que o motor respeita; Y é o mínimo do ritmo seguinte (as faixas se
 * encaixam sem sobrepor). O ritmo mais relaxado não tem teto: "4+ dias".
 */
export function paceRangeLabel(pace) {
  const min = paceMinGapDays(pace);
  const isLast = pace === Object.keys(PACE_FREE_DAYS).at(-1);
  return isLast ? `jogos a cada ${min}+ dias` : `jogos a cada ${min}-${min + 1} dias`;
}
