"use client";
import { useRef, useState } from "react";
import { hasCaptain, layoutLineup, pitchLabel, pitchRowTops, shortName } from "../../../lib/gameDetailsCore";
import { teamLabel } from "../../../lib/textUtils";
import { BG_ALT, BODY, BORDER, FONT_DISPLAY, FONT_MONO, GREEN_DARK, MUTED, TEXT } from "../../../lib/tokens";
import { EmptyNote } from "./ui";

const PITCH_BG = "#f0f8f2";
const PITCH_LINE = "#bddac6";
const AWAY_DOT = "#334155";

/**
 * Campo vertical: ataque em cima, goleiro embaixo. Cada linha de jogadores é
 * distribuída igualmente na largura (10 px de folga de cada lado), então
 * funciona pra qualquer formação (4-3-3, 3-5-2, 4-2-3-1...).
 */
function Pitch({ lineup, dot }) {
  const rows = layoutLineup(lineup);
  const tops = pitchRowTops(rows.length);
  const line = { position: "absolute", border: `1px solid ${PITCH_LINE}` };
  return (
    <div data-testid="pitch" style={{ position: "relative", height: 310, background: PITCH_BG, borderRadius: 12, overflow: "hidden", width: "100%" }}>
      <div style={{ ...line, left: 12, right: 12, top: 12, bottom: 12, borderRadius: 2 }} />
      <div style={{ position: "absolute", left: 12, right: 12, top: 155, height: 1, background: PITCH_LINE }} />
      <div style={{ ...line, width: 80, height: 80, left: "50%", top: 115, transform: "translateX(-50%)", borderRadius: "50%", boxSizing: "border-box" }} />
      <div style={{ ...line, width: 156, height: 46, left: "50%", top: 12, transform: "translateX(-50%)", boxSizing: "border-box" }} />
      <div style={{ ...line, width: 156, height: 46, left: "50%", top: 252, transform: "translateX(-50%)", boxSizing: "border-box" }} />
      {rows.map((row, ri) =>
        row.map((p, pi) => (
          <div key={`${ri}-${p.id ?? pi}`} data-player={p.name} style={{ position: "absolute", top: tops[ri], left: `calc(10px + (100% - 20px) * ${(pi + 0.5) / row.length})`, transform: "translateX(-50%)", width: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ background: dot, width: 30, height: 30, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: "#fff", margin: 0 }}>{p.number ?? ""}</p>
            </div>
            <div style={{ background: "#fff", borderRadius: 3, padding: "2px 4px", maxWidth: 80, boxSizing: "border-box" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 11, lineHeight: "normal", color: TEXT, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pitchLabel(p)}</p>
            </div>
          </div>
        )),
      )}
    </div>
  );
}

function Reserves({ players }) {
  return (
    <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: TEXT, margin: 0 }}>Reservas · {players.length} {players.length === 1 ? "jogador" : "jogadores"}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 8px" }}>
        {players.map((p, i) => (
          <div key={`${p.id ?? i}`} style={{ display: "flex", gap: 8, minWidth: 0 }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, lineHeight: "normal", color: MUTED, width: 22, flexShrink: 0, margin: 0 }}>{p.number ?? ""}</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.4, color: TEXT, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortName(p.name)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const TeamBlock = ({ innerRef, title, lineup, dot }) => (
  <div ref={innerRef} style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, lineHeight: 1.4, color: TEXT, margin: 0 }}>{title}</p>
      {lineup.formation && <p style={{ fontFamily: FONT_MONO, fontSize: 12, lineHeight: 1.4, color: MUTED, margin: 0 }}>{lineup.formation}</p>}
    </div>
    <Pitch lineup={lineup} dot={dot} />
    {lineup.coach && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.4, color: BODY, margin: 0 }}>Técnico: {lineup.coach}</p>}
    {lineup.substitutes.length > 0 && <Reserves players={lineup.substitutes} />}
  </div>
);

/** Aba Escalação: os dois times completos (no celular, um embaixo do outro; no desktop, lado a lado). */
export function AbaEscalacao({ details, isMobile }) {
  const [focus, setFocus] = useState("home");
  const homeRef = useRef(null);
  const awayRef = useRef(null);
  if (!details || !details.lineups) {
    return <EmptyNote title="Sem escalação para este jogo" text="A API-Football não trouxe a escalação desta partida (isso acontece mais em competições menores)." />;
  }
  const { lineups, teams } = details;
  const go = (side) => {
    setFocus(side);
    const el = side === "home" ? homeRef.current : awayRef.current;
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div role="group" aria-label="Escolher o time" style={{ background: BG_ALT, borderRadius: 8, padding: 4, display: "flex", gap: 4 }}>
          {[["home", "Mandante"], ["away", "Visitante"]].map(([side, label]) => (
            <div key={side} onClick={() => go(side)} role="button" aria-pressed={focus === side} style={{ background: focus === side ? "#fff" : "transparent", borderRadius: 6, padding: "7px 12px", cursor: "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: focus === side ? 700 : 400, fontSize: 12, lineHeight: 1.4, color: focus === side ? GREEN_DARK : MUTED, margin: 0, whiteSpace: "nowrap" }}>{label}</p>
            </div>
          ))}
        </div>
        {hasCaptain(lineups) && <p style={{ fontFamily: FONT_MONO, fontSize: 10, lineHeight: 1.4, color: MUTED, margin: 0, whiteSpace: "nowrap" }}>C = CAPITÃO</p>}
      </div>
      {isMobile && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, lineHeight: 1.4, color: MUTED, margin: 0 }}>Dois times completos abaixo. Role para ver o visitante.</p>}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 20 : 20, alignItems: "flex-start" }}>
        <TeamBlock innerRef={homeRef} title={`${teamLabel(teams.home.name)} · Mandante`} lineup={lineups.home} dot={GREEN_DARK} />
        <TeamBlock innerRef={awayRef} title={`${teamLabel(teams.away.name)} · Visitante`} lineup={lineups.away} dot={AWAY_DOT} />
      </div>
    </div>
  );
}
