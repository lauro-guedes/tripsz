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
