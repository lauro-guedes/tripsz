"use client";
/**
 * Peças compartilhadas pelos cartões de jogo de Buscar Jogos, Meu Calendário e Meus Jogos:
 * o mesmo fundo, a mesma linha de data/hora, a mesma linha de liga e o mesmo link de remover.
 * Mudou aqui, muda nas três telas.
 */
import { kickoffParts, todayInSaoPaulo } from "../../lib/calendarUtils";
import { BG_ALT, BORDER, FONT_DISPLAY, FONT_MONO, GREEN_DARK, MUTED } from "../../lib/tokens";

export const GAME_CARD_STYLE = { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 10 };

/** Partes da data (dia da semana, dia, mês, hora) a partir de um instante (kickoff) ou só de uma data ("2026-09-14"). */
export function gameParts({ kickoff, matchDate }) {
  if (kickoff) return kickoffParts(kickoff);
  if (matchDate) return kickoffParts(`${String(matchDate).slice(0, 10)}T12:00:00-03:00`);
  return null;
}

/**
 * "TER, 06 OUT • 21:35" — verde, fonte mono, caixa alta. O ano só aparece quando não é o ano atual.
 * `time` = false esconde a hora (jogo sem horário). `right` = etiqueta à direita ("JÁ PASSOU", "+150 XP"...).
 */
export function GameDateLine({ parts, time = true, right }) {
  if (!parts) return null;
  const thisYear = Number(todayInSaoPaulo().slice(0, 4));
  const text = `${parts.weekdayAbbr}, ${String(parts.day).padStart(2, "0")} ${parts.monthAbbr}${parts.year !== thisYear ? ` ${parts.year}` : ""}${time && parts.time ? ` • ${parts.time}` : ""}`;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: GREEN_DARK, textTransform: "uppercase", margin: 0 }}>{text}</p>
      {right}
    </div>
  );
}

/** "Serie B • Brazil" */
export function GameLeagueLine({ children }) {
  if (!children) return null;
  return <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>{children}</p>;
}

/** Etiqueta pequena ao lado da data: tone "gray" (JÁ PASSOU), "green" (RECÉM-ADICIONADO, XP). */
export function GameTag({ children, tone = "gray", title, big }) {
  const green = tone === "green";
  return (
    <div title={title} style={{ background: green ? "#eafbf1" : BG_ALT, padding: big ? "5px 11px" : "4px 8px", borderRadius: big ? 6 : 4 }}>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: big ? 13 : 9, color: green ? GREEN_DARK : MUTED, margin: 0, whiteSpace: "nowrap" }}>{children}</p>
    </div>
  );
}

/** Link de remover: vermelho e sublinhado, igual em todas as telas. */
export function GameRemoveLink({ children, onClick, disabled }) {
  return (
    <p onClick={disabled ? undefined : onClick} role="button" style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", textDecoration: "underline", margin: 0, cursor: disabled ? "default" : "pointer", width: "fit-content", opacity: disabled ? 0.6 : 1 }}>
      {children}
    </p>
  );
}
