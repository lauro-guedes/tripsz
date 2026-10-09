/**
 * Casa uma linha do Futbology com um jogo REAL da API-Football — lógica PURA.
 *
 * Como a linha só tem data, placar e um texto "estádio mandante visitante" sem
 * separadores, a gente faz o caminho inverso: pega todos os jogos daquela data
 * que terminaram com o MESMO PLACAR e vê qual deles "explica" o texto (nome do
 * estádio + mandante + visitante). Com data + placar, sobram poucos candidatos,
 * e a sobreposição de palavras escolhe o certo mesmo quando os nomes são
 * escritos diferente ("Olympique de Marseille" x "Marseille").
 */

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Palavras que não ajudam a identificar (siglas de clube, "estádio", conectivos...).
const STOP = new Set([
  "fc", "cf", "sc", "ec", "ac", "ca", "cd", "cs", "se", "sd", "ad", "aa", "cr", "rc", "sk", "fk", "bc", "afc", "acf", "ssc", "us", "as", "ss", "rj", "sp", "mg", "fbpa",
  "club", "clube", "de", "da", "do", "dos", "das", "del", "di", "la", "le", "el", "los", "las", "y", "e", "the", "of",
  "estadio", "stadium", "stade", "stadio", "stadion", "estadi", "arena", "parque", "park", "campo", "municipal", "nacional", "cidade", "ciudad",
]);

export function tokens(text) {
  return norm(text).replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !STOP.has(t));
}

/** Pontua o quanto um jogo da API explica o texto da linha. Devolve 0..1, ou 0 se não faz sentido. */
export function scoreFixture(textTokens, fx) {
  const homeT = tokens(fx.home);
  const awayT = tokens(fx.away);
  const venueT = tokens(fx.venue);
  if (textTokens.length === 0 || homeT.length === 0 || awayT.length === 0) return 0;

  // Posição em que a palavra aparece no texto. Aceita também prefixo
  // ("inter" x "internazionale"), desde que a menor tenha 4+ letras.
  const posOf = (t) => {
    let found = -1;
    for (let i = 0; i < textTokens.length; i++) {
      const x = textTokens[i];
      const same = x === t || (Math.min(x.length, t.length) >= 4 && (x.startsWith(t) || t.startsWith(x)));
      if (same) { found = i; break; }
    }
    return found;
  };
  const hits = (list) => list.map(posOf).filter((p) => p !== -1);
  const firstHit = (list) => { const idx = hits(list); return idx.length ? Math.min(...idx) : -1; };
  const h = firstHit(homeT);
  const a = firstHit(awayT);
  if (h === -1 || a === -1) return 0; // os dois times precisam aparecer
  if (h > a) return 0; // mandante vem antes do visitante

  const all = [...new Set([...homeT, ...awayT, ...venueT])];
  const matched = all.filter((t) => posOf(t) !== -1).length;
  const recall = matched / all.length; // quanto do que a API diz aparece no texto
  const explains = (x) => all.some((t) => x === t || (Math.min(x.length, t.length) >= 4 && (x.startsWith(t) || t.startsWith(x))));
  const coverage = textTokens.filter(explains).length / textTokens.length; // quanto do texto a API explica
  const homeShare = hits(homeT).length / homeT.length;
  const awayShare = hits(awayT).length / awayT.length;
  return 0.35 * coverage + 0.25 * recall + 0.2 * homeShare + 0.2 * awayShare;
}

export const MIN_SCORE = 0.5;
export const MIN_MARGIN = 0.08;

/**
 * row: { text, homeScore, awayScore } — fixtures: [{ id, home, away, venue, goalsHome, goalsAway, ... }]
 * Devolve { fixture, score } quando acha um jogo com certeza razoável, senão null.
 */
export function matchRow(row, fixtures) {
  const hs = Number(row.homeScore);
  const as = Number(row.awayScore);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return null;
  const textTokens = tokens(row.text);
  const scored = fixtures
    .filter((f) => f.goalsHome === hs && f.goalsAway === as)
    .map((f) => ({ fixture: f, score: scoreFixture(textTokens, f) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  if (scored.length === 0) return null;
  const [best, second] = scored;
  if (best.score < MIN_SCORE) return null;
  if (second && best.score - second.score < MIN_MARGIN) return null; // empate: melhor deixar a pessoa decidir
  return best;
}
