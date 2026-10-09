/**
 * Funções pequenas de texto usadas em mais de um lugar.
 */
const INITIALS_SKIP_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "di", "van", "der", "del", "la", "le", "fc", "cf", "ac", "sc", "ca"]);
export function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter((w) => !INITIALS_SKIP_WORDS.has(w.toLowerCase()));
  if (parts.length === 0) return name.trim()[0]?.toUpperCase() || "?";
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

/**
 * Nome do time pra mostrar na tela: a API-Football marca time feminino com
 * "W" ou "Women" no fim ("Corinthians W"); aqui vira "Corinthians-Feminino".
 * Só pra exibir — o nome guardado e usado nas buscas (escudo etc.) não muda.
 */
export function teamLabel(name) {
  if (!name || typeof name !== "string") return name;
  return name.replace(/\s*[-\s]\s*(W|Women)$/i, "-Feminino");
}
