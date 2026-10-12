"use client";
import { ArrowLeftRight, CornerDownLeft, RectangleVertical, Target, Tv } from "lucide-react";
import { useState } from "react";
import { buildTimeline, formatMinute, goalsHeadline } from "../../../lib/gameDetailsCore";
import { BG, BG_ALT, BODY, BORDER, FONT_DISPLAY, FONT_MONO, GREEN_DARK, GREEN_SOFT, MUTED, TEXT } from "../../../lib/tokens";
import { Icon } from "../../ui/Icon";
import { EmptyNote } from "./ui";

/** Ícone de cada tipo de acontecimento: bola do projeto pro gol; o resto, ícones simples. */
function EventIcon({ kind }) {
  const goal = kind === "goal";
  const color = kind === "goal" || kind === "penalty" || kind === "own-goal" ? GREEN_DARK : kind === "red" ? "#dc2626" : MUTED;
  if (goal) return <Icon name="soccerBall" size={16} color={color} />;
  if (kind === "penalty" || kind === "missed-penalty") return <Target size={16} color={color} />;
  if (kind === "own-goal") return <CornerDownLeft size={16} color={color} />;
  if (kind === "yellow" || kind === "red") return <RectangleVertical size={16} color={color} />;
  if (kind === "sub") return <ArrowLeftRight size={16} color={color} />;
  return <Tv size={16} color={color} />;
}

function Row({ it, isMobile }) {
  const strong = it.isGoal;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch", padding: "10px 0", width: "100%" }}>
      <p style={{ fontFamily: FONT_MONO, fontWeight: strong ? 700 : 400, fontSize: 13, lineHeight: "normal", color: strong ? TEXT : MUTED, width: 36, flexShrink: 0, margin: 0 }}>{formatMinute(it.minute, it.extra)}</p>
      <div style={{ width: 28, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ background: strong ? GREEN_SOFT : BG_ALT, width: 28, height: 28, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <EventIcon kind={it.kind} />
        </div>
        <div style={{ background: BORDER, width: 1, flex: 1, minHeight: 8, marginTop: 4, marginBottom: -14 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: strong ? 700 : 500, fontSize: isMobile ? 13 : 14, lineHeight: "normal", color: strong ? TEXT : MUTED, margin: 0, flex: 1, minWidth: 0 }}>{it.title}</p>
          {it.isGoal && it.scoreAfter && <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, lineHeight: 1.4, color: GREEN_DARK, margin: 0, whiteSpace: "nowrap" }}>{it.scoreAfter}</p>}
        </div>
        {it.label && <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 10, lineHeight: 1.4, color: GREEN_DARK, margin: 0 }}>{it.label}</p>}
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, lineHeight: 1.4, color: MUTED, margin: 0 }}>{it.subtitle}</p>
      </div>
    </div>
  );
}

function Summary({ t, details }) {
  const ownGoal = t.goals.find((g) => g.kind === "own-goal");
  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, width: 208, flexShrink: 0, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: TEXT, margin: 0 }}>{goalsHeadline(t.goals.length)}</p>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, lineHeight: 1.4, color: TEXT, margin: 0 }}>{t.finalScore.home} × {t.finalScore.away}</p>
      {t.goals.map((g) => (
        <p key={g.key} style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.4, color: BODY, margin: 0 }}>{g.minute} {g.text}</p>
      ))}
      <div style={{ background: BORDER, height: 1, width: "100%" }} />
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, lineHeight: 1.5, color: MUTED, margin: 0 }}>
        {ownGoal && ownGoal.beneficiary ? `O gol contra de ${ownGoal.surname} conta para o ${ownGoal.beneficiary}. ` : ""}
        Placar final: {t.finalScore.home} a {t.finalScore.away}.{details.penalty ? ` Nos pênaltis: ${details.penalty.home} a ${details.penalty.away}.` : ""}
      </p>
    </div>
  );
}

/** Aba Gols: linha do tempo com filtro "Só gols / Tudo"; no desktop, o resumo dos gols ao lado. */
export function AbaGols({ details, isMobile }) {
  const [filter, setFilter] = useState("tudo");
  if (!details || details.events.length === 0) {
    return <EmptyNote title="Sem acontecimentos para este jogo" text="Não encontramos os gols, cartões e substituições desta partida." />;
  }
  const t = buildTimeline(details);
  const items = filter === "gols" ? t.items.filter((i) => i.isGoal) : t.items;
  const penaltyNote = details.penalty ? ` (${details.penalty.home}–${details.penalty.away} nos pênaltis)` : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, lineHeight: 1.4, color: TEXT, margin: 0 }}>Linha do tempo</p>
        <div role="group" aria-label="Filtro de eventos" style={{ background: BG_ALT, borderRadius: 8, padding: 3, display: "flex" }}>
          {[["gols", "Só gols"], ["tudo", "Tudo"]].map(([id, label]) => (
            <div key={id} onClick={() => setFilter(id)} role="button" aria-pressed={filter === id} style={{ background: filter === id ? "#fff" : "transparent", borderRadius: 6, padding: "7px 10px", cursor: "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: filter === id ? 700 : 400, fontSize: 11, lineHeight: 1.4, color: filter === id ? GREEN_DARK : MUTED, margin: 0, whiteSpace: "nowrap" }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {items.length === 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: "8px 0" }}>Nenhum gol neste jogo.</p>}
          {items.map((it) => <Row key={it.key} it={it} isMobile={isMobile} />)}
          <div style={{ display: "flex", gap: 12, paddingTop: 12 }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 12, lineHeight: 1.4, color: MUTED, margin: 0 }}>{t.endLabel}</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: TEXT, margin: 0 }}>
              Fim de jogo · {t.homeName} {t.finalScore.home} × {t.finalScore.away} {t.awayName}{penaltyNote}
            </p>
          </div>
        </div>
        {!isMobile && <Summary t={t} details={details} />}
      </div>
    </div>
  );
}
