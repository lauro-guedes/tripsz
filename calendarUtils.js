/**
 * Funções puras de data/calendário usadas pelas telas "Buscar jogos" e
 * "Meu calendário". Tudo no fuso de Brasília — é o fuso em que a busca
 * pede os horários à API.
 */
export const TZ = "America/Sao_Paulo";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_ABBR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAYS_ABBR = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export const RADIUS_OPTIONS = [50, 150, 300, 500];
export const WEEKDAY_HEADERS = WEEKDAYS_ABBR;

/** Hoje (AAAA-MM-DD) no fuso de Brasília. */
export function todayInSaoPaulo(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Quebra o instante de um jogo em partes, sempre em horário de Brasília. */
export function kickoffParts(iso) {
  const d = new Date(iso);
  const dateKey = d.toLocaleDateString("en-CA", { timeZone: TZ });
  const [year, month1, day] = dateKey.split("-").map(Number);
  const weekdayIdx = new Date(Date.UTC(year, month1 - 1, day, 12)).getUTCDay();
  const time = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  return {
    dateKey,
    year,
    month: month1 - 1,
    day,
    weekdayLong: WEEKDAYS[weekdayIdx],
    weekdayAbbr: WEEKDAYS_ABBR[weekdayIdx],
    monthAbbr: MONTHS_ABBR[month1 - 1],
    dayMonthYear: `${String(day).padStart(2, "0")} ${MONTHS_ABBR[month1 - 1]} ${year}`,
    time,
  };
}

/** "2026-10-17" -> "17 de outubro de 2026". */
export function formatLongDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

export function monthName(month) {
  return MONTHS[month];
}

/** "Outubro 2026". */
export function monthTitle(year, month) {
  return `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${year}`;
}

export function shiftMonth(year, month, delta) {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/**
 * Grade do mês, começando no domingo. Cada célula: { dateKey, day, inMonth }.
 * Inclui os dias do mês anterior/seguinte que completam as semanas.
 */
export function buildMonthGrid(year, month) {
  const startOffset = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const weeks = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(Date.UTC(year, month, 1 - startOffset + i));
    const cell = {
      dateKey: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
    };
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push(cell);
  }
  return weeks;
}

/** "São Paulo, SP, Brasil" -> "São Paulo, SP" (tira só o país, que é o último pedaço). */
export function cityWithoutCountry(label) {
  const parts = (label || "").split(",").map((s) => s.trim());
  return parts.length > 1 ? parts.slice(0, -1).join(", ") : parts[0] || "";
}

/** "São Paulo, SP, Brasil" -> "São Paulo". */
export function cityShortName(label) {
  return (label || "").split(",")[0].trim();
}
