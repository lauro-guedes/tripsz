"use client";
import { cardsNote, statRows } from "../../../lib/gameDetailsCore";
import { teamLabel } from "../../../lib/textUtils";
import { BODY, BORDER, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_DARK, MUTED, SLATE, TEXT } from "../../../lib/tokens";
import { EmptyNote, SectionTitle } from "./ui";

/** Barras proporcionais: cada lado ocupa a fatia do valor dele; lado zerado some; os dois zerados ficam iguais. */
function Bars({ home, away }) {
  const none = home === 0 && away === 0;
  return (
    <div style={{ display: "flex", gap: home > 0 && away > 0 ? 6 : 0, height: 7, width: "100%" }}>
      {none ? (
        <>
          <div style={{ background: BORDER, height: 7, borderRadius: 999, flex: 1 }} />
          <div style={{ background: BORDER, height: 7, borderRadius: 999, flex: 1, marginLeft: 6 }} />
        </>
      ) : (
        <>
          {home > 0 && <div data-bar="home" style={{ background: GREEN, height: 7, borderRadius: 999, flex: `${home} 1 0` }} />}
          {away > 0 && <div data-bar="away" style={{ background: SLATE, height: 7, borderRadius: 999, flex: `${away} 1 0` }} />}
        </>
      )}
    </div>
  );
}

function Dot({ color }) {
  return <div style={{ background: color, width: 8, height: 8, borderRadius: 999 }} />;
}

/** Aba Estatísticas: "O jogo em números" — mandante x visitante em barras. */
export function AbaEstatisticas({ details, isMobile }) {
  const rows = statRows(details);
  if (rows.length === 0) {
    return <EmptyNote title="Sem estatísticas para este jogo" text="A API-Football não tem os números desta partida (isso acontece mais em competições menores)." />;
  }
  const home = teamLabel(details.teams.home.name);
  const away = teamLabel(details.teams.away.name);
  return (
    <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <div style={{ width: "100%", maxWidth: isMobile ? "100%" : 640, display: "flex", flexDirection: "column", gap: 22 }}>
        <SectionTitle title="O jogo em números" subtitle="Comparativo dos 90 minutos e acréscimos." />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Dot color={GREEN} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: TEXT, margin: 0 }}>{home}</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, lineHeight: 1.4, color: MUTED, margin: 0 }}>Mandante</p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, lineHeight: 1.4, color: MUTED, margin: 0 }}>Visitante</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: TEXT, margin: 0 }}>{away}</p>
            <Dot color={SLATE} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, lineHeight: "normal", color: GREEN_DARK, width: 55, margin: 0 }}>{r.home}{r.suffix}</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: TEXT, margin: 0, whiteSpace: "nowrap" }}>{r.label}</p>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, lineHeight: "normal", color: BODY, width: 55, margin: 0, textAlign: "right" }}>{r.away}{r.suffix}</p>
              </div>
              <Bars home={r.home} away={r.away} />
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, lineHeight: 1.5, color: MUTED, margin: 0 }}>{cardsNote(details)}</p>
        </div>
      </div>
    </div>
  );
}
