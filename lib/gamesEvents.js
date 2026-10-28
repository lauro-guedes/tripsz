/** Aviso interno: "os jogos (ou o perfil público) mudaram" — o app confere se desbloqueou conquista. */
export const GAMES_CHANGED_EVENT = "tripsz:games-changed";
export function notifyGamesChanged() {
  try { window.dispatchEvent(new Event(GAMES_CHANGED_EVENT)); } catch { /* sem window */ }
}
