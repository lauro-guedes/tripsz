/**
 * Chave de busca de nomes (estádios, times): minúsculas, sem acento, sem til,
 * sem apóstrofo, e qualquer outra pontuação (hífen, ponto, parênteses, vírgula)
 * vira espaço. Assim "Maracanã", "Beira-Rio", "St. James' Park" e "Brøndby"
 * viram "maracana", "beira rio", "st james park" e "brondby".
 */
const SPECIAL = { "ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i" };

export function searchKey(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[øæœßłđðþı]/g, (c) => SPECIAL[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mesma chave, sem espaços — pra "beira rio" casar com "beirario". */
export function compactKey(str) {
  return searchKey(str).replace(/ /g, "");
}
