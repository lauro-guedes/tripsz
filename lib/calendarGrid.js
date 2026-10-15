/**
 * Contas do calendário de mês — regras PURAS (sem rede, sem fuso do aparelho). Datas no formato "AAAA-MM-DD";
 * comparar duas datas desse formato como texto já dá a ordem certa.
 */
export const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"]; // semana começa no domingo

const pad = (n) => String(n).padStart(2, "0");
export const toIso = (y, m0, d) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

/** "2026-10-14" -> { y: 2026, m0: 9, d: 14 } (m0 = mês de 0 a 11). Texto fora do formato: null. */
export function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? { y: Number(m[1]), m0: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

export const monthOf = (iso) => {
  const p = parseIso(iso);
  return p ? { y: p.y, m0: p.m0 } : null;
};
export const monthIndex = ({ y, m0 }) => y * 12 + m0;
export const daysInMonth = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

export function addMonths({ y, m0 }, delta) {
  const t = y * 12 + m0 + delta;
  return { y: Math.floor(t / 12), m0: ((t % 12) + 12) % 12 };
}

/** As 42 casas do mês (6 semanas, domingo primeiro). Casas fora do mês são null, pra a grade não mudar de altura. */
export function monthCells(y, m0) {
  const lead = new Date(Date.UTC(y, m0, 1)).getUTCDay();
  const n = daysInMonth(y, m0);
  return Array.from({ length: 42 }, (_, i) => {
    const d = i - lead + 1;
    return d >= 1 && d <= n ? { day: d, iso: toIso(y, m0, d) } : null;
  });
}

export const monthTitle = ({ y, m0 }) => `${MONTHS_PT[m0]} de ${y}`;

/** "2026-10-14" -> "14 de outubro de 2026" */
export function longDate(iso) {
  const p = parseIso(iso);
  return p ? `${p.d} de ${MONTHS_PT[p.m0]} de ${p.y}` : "";
}

/** "2026-10-14" -> "14/10/2026" */
export const shortDate = (iso) => (parseIso(iso) ? iso.split("-").reverse().join("/") : "");

/** Dia fora do intervalo permitido [min, max]? */
export const isDisabled = (iso, min, max) => (!!min && iso < min) || (!!max && iso > max);

/** Mantém o mês dentro dos meses que têm algum dia permitido. */
export function clampMonth(month, min, max) {
  const lo = monthOf(min);
  const hi = monthOf(max);
  let v = month;
  if (lo && monthIndex(v) < monthIndex(lo)) v = lo;
  if (hi && monthIndex(v) > monthIndex(hi)) v = hi;
  return v;
}

/**
 * Mês em que o calendário abre: o da data já escolhida; senão o da âncora (a ida, no calendário da volta);
 * senão o do mínimo; senão o de hoje.
 */
export function initialMonth({ value, anchor, min, max, today }) {
  const first = monthOf(value) || monthOf(anchor) || monthOf(min) || monthOf(today) || { y: 1970, m0: 0 };
  return clampMonth(first, min, max);
}

/** Dia entre a âncora (ida) e a data escolhida (volta), sem contar as pontas. */
export const inBetween = (iso, a, b) => !!a && !!b && iso > a && iso < b;
