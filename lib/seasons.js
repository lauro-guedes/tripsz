/**
 * Temporadas disponíveis em "Meus Jogos" (registrar jogos que a pessoa já viu).
 *
 * Antes a lista era fixa (2022–2024). Agora vai do ano atual até 2010, que é
 * onde a API-Football começa a ter dados de jogos. A API em si é quem decide
 * se o plano da conta dá acesso a cada temporada — se não der, mostramos a
 * mensagem dela de forma amigável (ver friendlySeasonError).
 *
 * Convenção da API: "temporada 2024" = a que COMEÇA em 2024 (Europa: 2024/25;
 * ligas de ano-calendário como o Brasileirão: o ano de 2024).
 */
export const MIN_SEASON = 2010;

/** A temporada mais recente que faz sentido listar: a do ano do calendário atual. */
export function maxSeason(now = new Date()) {
  return now.getFullYear();
}

export function isValidSeason(n, now = new Date()) {
  return Number.isInteger(n) && n >= MIN_SEASON && n <= maxSeason(now);
}

/** 2024 -> "2024/25" */
export function formatSeason(year) {
  return `${year}/${String(year + 1).slice(-2)}`;
}

/** Lista pro <select>: da mais nova pra mais antiga. */
export function seasonOptions(now = new Date()) {
  const out = [];
  for (let y = maxSeason(now); y >= MIN_SEASON; y--) out.push({ value: y, label: formatSeason(y) });
  return out;
}

/** Se o erro da API-Football é "seu plano não tem essa temporada", devolve um texto claro; senão null. */
export function friendlySeasonError(message) {
  if (/access to this season/i.test(message || "")) {
    return "A sua conta da API-Football não dá acesso a essa temporada. Escolha outra mais recente ou preencha o jogo manualmente.";
  }
  return null;
}
