/**
 * Leitura do export do Futbology — lógica PURA (roda no navegador e no servidor).
 *
 * O arquivo não tem colunas: cada linha é
 *   "<data> <estádio> <mandante> <visitante> <gols casa> <gols fora>: ;<competição>.%"
 * com estádio + mandante + visitante colados num texto só. Além disso o app
 * "disfarça" o texto: troca letras por parecidas de outros alfabetos (cirílico,
 * armênio) e, nessas linhas, apaga todo "M" maiúsculo ("Meazza" vira "eаzzа").
 * Aqui a gente desfaz isso; quem separa estádio/times é o casamento com os
 * jogos reais (lib/futbologyMatch.js).
 */

// Letras "disfarçadas" -> letra latina de verdade.
export const HOMOGLYPH_MAP = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x",
  "і": "i", "ѕ": "s", "һ": "h", "ո": "n", "ս": "u", "ի": "i", "ց": "g",
  "ր": "r", "ա": "a", "Ա": "A", "Ѕ": "S", "А": "A", "Е": "E", "О": "O",
  "Р": "P", "С": "C",
};
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPH_MAP).join("")}]`);

export const normalizeHomoglyphs = (text) => (text || "").split("").map((c) => HOMOGLYPH_MAP[c] || c).join("");

// Palavras que se escrevem com minúscula mesmo — não são "M" apagado.
const LOWERCASE_WORDS = new Set([
  "de", "da", "do", "dos", "das", "del", "di", "du", "la", "le", "el", "los", "las", "y", "e", "van", "von", "der", "den", "al", "a", "o", "as", "os", "im", "am", "zur", "ten", "ter",
]);

/**
 * Nas linhas disfarçadas o "M" maiúsculo some. Uma palavra que começa em
 * minúscula e não é um conectivo ("de", "do"...) quase sempre perdeu o M:
 * "orumbi" -> "Morumbi", "ilano" -> "Milano", "adrid" -> "Madrid".
 */
export function restoreMissingM(text) {
  return text
    .split(" ")
    .map((w) => {
      if (!w || !/^[a-zà-ÿ]/.test(w)) return w;
      if (LOWERCASE_WORDS.has(w.normalize("NFD").replace(/[̀-ͯ]/g, ""))) return w;
      return `M${w}`;
    })
    .join(" ");
}

/** A linha tem letras disfarçadas? (então o M apagado vale pra ela) */
export const isObfuscatedLine = (rawLine) => HOMOGLYPH_RE.test(rawLine || "");

const PORTUGUESE_MONTHS = { jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06", jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12" };

/**
 * Uma linha do Futbology -> { date, rawDate, text, homeScore, awayScore, competition }.
 * `text` é "estádio mandante visitante" já limpo (sem letras disfarçadas e com os M de volta).
 * Devolve null se a linha não tem o formato.
 */
export function parseFutbologyLine(rawLine) {
  const obfuscated = isObfuscatedLine(rawLine);
  let line = normalizeHomoglyphs(rawLine).replace(/ /g, " ");
  const semi = line.indexOf(";");
  if (semi === -1) return null;
  const blob = line.slice(0, semi);
  const compPart = line.slice(semi + 1);

  const dateMatch = blob.match(/^\s*(\d{1,2}) de (\w{3})\.? de (\d{4})/i);
  let date = null;
  let rawDate = "";
  let rest = blob;
  if (dateMatch) {
    rawDate = dateMatch[0].trim();
    const month = PORTUGUESE_MONTHS[dateMatch[2].toLowerCase()];
    if (month) date = `${dateMatch[3]}-${month}-${dateMatch[1].padStart(2, "0")}`;
    rest = blob.slice(dateMatch[0].length);
  }
  rest = rest.replace(/\s+/g, " ").trim();

  let homeScore = "";
  let awayScore = "";
  let text = rest;
  const scoreMatch = rest.match(/(\d+)\s+(\d+)\s*:?\s*[\d.]*\s*$/);
  if (scoreMatch) {
    homeScore = scoreMatch[1];
    awayScore = scoreMatch[2];
    text = rest.slice(0, scoreMatch.index).trim();
  }
  if (obfuscated) text = restoreMissingM(text);

  const competition = compPart.replace(/\.?%\s*$/, "").replace(/\.\s*$/, "").trim();
  return { date, rawDate, text, homeScore, awayScore, competition, obfuscated };
}

// Palpite de país (nome da API-Football, em inglês) pelo nome da competição —
// só pra pré-preencher quando o jogo não é reconhecido. Continentais: sem palpite.
const COMPETITION_COUNTRY = [
  [/ligue [12]|coupe de france/i, "France"],
  [/\bserie [ab]\b|coppa italia/i, "Italy"],
  [/eredivisie|knvb|eerste divisie/i, "Netherlands"],
  [/primeira liga|ta[cç]a de portugal|liga portugal/i, "Portugal"],
  [/premier league|championship|fa cup|efl/i, "England"],
  [/la ?liga|copa del rey|segunda divisi/i, "Spain"],
  [/bundesliga|dfb/i, "Germany"],
  [/liga profesional argentina|primera nacional|primera b|copa argentina/i, "Argentina"],
  [/uruguay/i, "Uruguay"],
  [/campeonato (paulista|mineiro|carioca|capixaba|catarinense|paranaense|potiguar|rondoniense|acriano|gaucho|baiano|pernambucano|cearense|goiano|brasileiro)|s[eé]rie [a-d]\b|copa do brasil|copa do nordeste|copa s[aã]o paulo|copa paulista|copa santa catarina/i, "Brazil"],
];
export function guessCountryFromCompetition(competition) {
  const hit = COMPETITION_COUNTRY.find(([re]) => re.test(competition || ""));
  return hit ? hit[1] : "";
}
