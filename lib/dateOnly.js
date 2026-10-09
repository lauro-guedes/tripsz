/**
 * Data "AAAA-MM-DD" (a que vem do banco, sem horário) como Date ao meio-dia
 * LOCAL. `new Date("2025-06-21")` vira meia-noite UTC, que no Brasil é o dia
 * 20 às 21h — e a tela mostrava o jogo um dia antes.
 */
export function dateOnly(value) {
  const s = typeof value === "string" ? value.slice(0, 10) : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00`);
  return new Date(value);
}
