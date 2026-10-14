"use client";
/**
 * O jogo que acabou de ser salvo e a quem marcar — passa entre as telas "Quem foi com você?" e "Jogo salvo".
 * Fica no navegador (sobrevive a um F5) por 6 horas.
 */
const KEY = "tripsz_companion_draft";
const MAX_AGE_MS = 6 * 3600 * 1000;

export function saveDraft(draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, at: Date.now() }));
  } catch {
    // sem armazenamento: as telas voltam pra Meus Jogos
  }
}

/** { game, tagged } ou null (não há, está incompleto ou passou de 6 horas). */
export function readDraft() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!v || !v.game || !v.game.id || Date.now() - (v.at || 0) > MAX_AGE_MS) return null;
    return v;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // sem armazenamento
  }
}
