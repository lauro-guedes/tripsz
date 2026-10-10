"use client";
import { gameSeason } from "./seasons";

/* --- Meus Jogos: histórico real dos jogos registrados, agrupado por temporada --- */
// Temporada de um jogo registrado: europeia (jul–jun, "2026/27") ou, pra
// Brasileirão, Libertadores, América do Sul, MLS etc., ano-calendário ("2026").
export function seasonOfGame(g) {
  return gameSeason(g.match_date, { country: g.country, competition: g.competition });
}
