"use client";
import { Award, Share2 } from "lucide-react";
import { useState } from "react";
import { XP_TIERS, computeTier } from "../../../lib/fanLevels";
import { formatInt } from "../../../lib/gameDetailsCore";
import { teamLabel } from "../../../lib/textUtils";
import { BG, BG_ALT, BODY, BORDER, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_DARK, GREEN_SOFT, GREEN_SOFT_BORDER, MUTED, TEXT } from "../../../lib/tokens";
import { Icon } from "../../ui/Icon";

/* Conquistas que dão XP (as mesmas de "Minhas Conquistas"). */
const ACHIEVEMENTS = {
  "achievement-stadiums": { title: "5 Estádios", short: "Você completou 5 estádios diferentes.", text: "Cinco estádios diferentes no seu passaporte. A coleção não para de crescer." },
  "achievement-countries": { title: "3 Países", short: "Você já viu jogos em 3 países diferentes.", text: "A paixão pelo futebol não tem fronteiras. Você já acompanhou jogos em 3 países." },
  "achievement-champions": { title: "Champions League", short: "Seu primeiro jogo de Champions League.", text: "Seu primeiro jogo de Champions League ao vivo, direto da arquibancada." },
};

/** Ícone, título e frase de cada linha de XP. */
function rowInfo(part, game) {
  const stadium = game.stadium || "estádio";
  if (part.key === "game") return { icon: <Icon name="soccerBall" size={18} color={BODY} />, title: "Jogo", desc: "Mais uma partida no seu histórico." };
  if (part.key === "stadium") return { icon: <Icon name="stadium" size={18} color={BODY} />, title: "Estádio novo", desc: `Sua primeira visita ao ${stadium} nesta data.` };
  if (part.key === "country") return { icon: <Icon name="globe" size={18} color={BODY} />, title: "País novo", desc: `Primeiro jogo acompanhado no país: ${game.country || "—"}.` };
  const a = ACHIEVEMENTS[part.key];
  return { icon: <Award size={18} color={BODY} />, title: "Conquista desbloqueada", desc: a ? a.short : part.label };
}

/** Texto e ação do botão de compartilhar: compartilha pelo celular, ou copia o texto. */
export async function shareGame(game, xpTotal) {
  const hasScore = game.home_score != null && game.away_score != null;
  const placar = hasScore ? `${teamLabel(game.home_team)} ${game.home_score}×${game.away_score} ${teamLabel(game.away_team)}` : `${teamLabel(game.home_team)} × ${teamLabel(game.away_team)}`;
  const text = `Vi ${placar}${game.stadium ? ` no ${game.stadium}` : ""} e ganhei +${xpTotal} XP no meu Passaporte de Estádios do tripsz.`;
  const url = typeof window !== "undefined" ? window.location.origin : "";
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: "tripsz", text, url });
      return "shared";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelled"; // a pessoa fechou a janela de compartilhar
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`.trim());
    return "copied";
  } catch {
    return "failed";
  }
}

function XpRow({ part, game }) {
  const { icon, title, desc } = rowInfo(part, game);
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 0", width: "100%" }}>
      <div style={{ background: BG_ALT, width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, lineHeight: 1.4, color: TEXT, margin: 0 }}>{title}</p>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, lineHeight: 1.5, color: MUTED, margin: 0 }}>{desc}</p>
      </div>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, lineHeight: 1.4, color: GREEN_DARK, margin: 0, whiteSpace: "nowrap" }}>+{part.xp}</p>
    </div>
  );
}

function AchievementCard({ part }) {
  const a = ACHIEVEMENTS[part.key];
  if (!a) return null;
  return (
    <div style={{ background: GREEN_SOFT, border: `1px solid ${GREEN_SOFT_BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ background: "#fff", width: 42, height: 42, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="trophy" size={24} color={GREEN_DARK} />
        </div>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, lineHeight: 1.4, color: GREEN_DARK, margin: 0 }}>CONQUISTA DESBLOQUEADA</p>
      </div>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, lineHeight: 1.25, color: TEXT, margin: 0 }}>{a.title}</p>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.5, color: BODY, margin: 0 }}>{a.text}</p>
    </div>
  );
}

function NextTier({ totalXp }) {
  const tier = computeTier(totalXp);
  const next = XP_TIERS[tier.level] || null; // a lista está em ordem: o índice [nível] é a categoria seguinte
  const pct = next ? Math.min(100, (totalXp / next.min) * 100) : 100;
  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: TEXT, margin: 0 }}>{next ? `Rumo a ${next.name}` : `Categoria ${tier.name}`}</p>
        {next && <p style={{ fontFamily: FONT_MONO, fontSize: 10, lineHeight: 1.4, color: MUTED, margin: 0, whiteSpace: "nowrap" }}>{formatInt(totalXp)} / {formatInt(next.min)} XP</p>}
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} style={{ background: BORDER, height: 7, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ background: GREEN, height: 7, borderRadius: 999, width: `${pct}%` }} />
      </div>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.4, color: BODY, margin: 0 }}>{next ? `faltam ${formatInt(next.min - totalXp)} XP para ${next.name}` : "Você chegou ao topo da arquibancada."}</p>
    </div>
  );
}

/**
 * Aba XP: o que este jogo rendeu (jogo, estádio novo, país novo, conquistas),
 * quanto falta pra próxima categoria e o botão de compartilhar.
 * `xp` = { total, parts } de lib/xpRules (calculado na DATA do jogo);
 * `totalXp` = XP de todos os jogos da pessoa.
 */
export function AbaXP({ game, xp, totalXp, isMobile }) {
  const [shareState, setShareState] = useState(null);
  const achievements = (xp ? xp.parts : []).filter((p) => ACHIEVEMENTS[p.key]);
  const onShare = async () => {
    const r = await shareGame(game, xp ? xp.total : 0);
    if (r === "copied" || r === "failed") {
      setShareState(r);
      setTimeout(() => setShareState(null), 2500);
    }
  };

  const total = (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ fontFamily: FONT_MONO, fontSize: 11, lineHeight: 1.4, color: MUTED, margin: 0 }}>ESTA EXPERIÊNCIA RENDEU</p>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: isMobile ? 40 : 44, lineHeight: "normal", color: GREEN_DARK, margin: 0 }}>+{xp ? xp.total : 0} XP</p>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.4, color: MUTED, margin: 0 }}>Cada jogo faz sua história crescer.</p>
    </div>
  );
  const list = <div>{(xp ? xp.parts : []).map((p) => <XpRow key={p.key} part={p} game={game} />)}</div>;
  const cards = achievements.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{achievements.map((p) => <AchievementCard key={p.key} part={p} />)}</div>;

  const shareLabel = shareState === "copied" ? "Texto copiado!" : shareState === "failed" ? "Não foi possível compartilhar" : "Compartilhar este jogo";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {isMobile ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {total}
            {list}
          </div>
          {cards}
        </>
      ) : (
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
          <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
            {total}
            {cards}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>{list}</div>
        </div>
      )}
      <NextTier totalXp={totalXp} />
      <div onClick={onShare} role="button" style={{ background: GREEN, height: 46, borderRadius: 8, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <Share2 size={18} color="#fff" />
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, lineHeight: 1.4, color: "#fff", margin: 0 }}>{shareLabel}</p>
      </div>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, lineHeight: 1.4, color: MUTED, margin: 0 }}>XP calculado na data do jogo. Visitas posteriores não alteram os bônus já recebidos.</p>
    </div>
  );
}
