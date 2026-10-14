"use client";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { formatShortDate } from "../../lib/gameDetailsCore";
import { navigate } from "../../lib/navigate";
import { teamLabel } from "../../lib/textUtils";
import { BG, BORDER, FONT_MONO, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";
import { Wordmark } from "../ui/Wordmark";
import { GREEN_TINT, SLATE_BG, text } from "./ConviteUi";

export const FALLBACK_PHOTO = "/foto-estadio.jpg";

/** Página inteira: topo com a logo e "Entrar", e o conteúdo com o respiro do design. */
export function Shell({ isMobile, onLogin, children }) {
  return (
    <div style={{ background: BG, minHeight: "100vh", width: "100%" }}>
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, height: isMobile ? 64 : 80, padding: isMobile ? "0 20px" : "0 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark height={isMobile ? 28 : 32} onClick={() => navigate("/")} />
        {onLogin && (
          <p role="button" onClick={onLogin} style={text(13, GREEN_DARK, { fontWeight: 600, cursor: "pointer" })}>
            Entrar
          </p>
        )}
      </div>
      <div style={{ padding: isMobile ? "24px 20px 40px" : "40px 140px 56px", display: "flex", flexDirection: "column", gap: 24, boxSizing: "border-box" }}>{children}</div>
    </div>
  );
}

export function PageHeading({ label, title, subtitle, isMobile }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={text(10, MUTED, { fontFamily: FONT_MONO, lineHeight: 1.4, textTransform: "uppercase" })}>{label}</p>
      <h1 style={text(isMobile ? 26 : 32, TEXT, { fontWeight: 700, lineHeight: 1.3 })}>{title}</h1>
      {subtitle && <p style={text(14)}>{subtitle}</p>}
    </div>
  );
}

const BADGES = { valid: { bg: GREEN_TINT, color: GREEN_DARK, label: "Esse jogo já está te esperando" }, expired: { bg: SLATE_BG, color: MUTED, label: "Convite expirado" }, used: { bg: SLATE_BG, color: MUTED, label: "Convite já resgatado" } };

/** O jogo do convite: foto, situação, competição, placar, estádio. */
export function GameCard({ game, inviterName, state, photo, isMobile }) {
  const [broken, setBroken] = useState(false);
  const badge = BADGES[state] || BADGES.valid;
  const hasScore = game.home_score != null && game.away_score != null;
  const title = `${teamLabel(game.home_team)} ${hasScore ? `${game.home_score}×${game.away_score}` : "×"} ${teamLabel(game.away_team)}`;
  const place = [game.stadium, game.city].filter(Boolean).join(" · ");
  const label = [game.competition, formatShortDate(game.match_date)].filter(Boolean).join(" · ");
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", width: "100%" }}>
      <div style={{ height: isMobile ? 190 : 230, background: SLATE_BG }}>
        <img src={broken || !photo ? FALLBACK_PHOTO : photo} alt="" onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: badge.bg, borderRadius: 12, padding: "5px 9px", alignSelf: "flex-start" }}>
          <p style={text(10, badge.color, { fontFamily: FONT_MONO, fontWeight: 700, lineHeight: "normal" })}>{badge.label}</p>
        </div>
        {label && <p style={text(10, MUTED, { fontFamily: FONT_MONO, lineHeight: 1.4, textTransform: "uppercase" })}>{label}</p>}
        <p style={text(isMobile ? 22 : 24, TEXT, { fontWeight: 700 })}>{title}</p>
        {place && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Icon name="mapPin" size={16} color={MUTED} />
            <p style={text(13, MUTED, { lineHeight: "normal" })}>{place}</p>
          </div>
        )}
        <p style={text(13)}>Uma lembrança da arquibancada, compartilhada por {inviterName}.</p>
      </div>
    </div>
  );
}

/** "Enviado por Lauro · @lauro.g" */
export function InviterRow({ inviter }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ background: GREEN_TINT, border: "2px solid #fff", width: 40, height: 40, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <p style={text(13, GREEN_DARK, { fontWeight: 700, lineHeight: "normal" })}>{(inviter.firstName || "?").charAt(0).toUpperCase()}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <p style={text(13, TEXT, { fontWeight: 700 })}>
          Enviado por {inviter.firstName}
          {inviter.username && <span style={{ color: MUTED, fontWeight: 500 }}> · @{inviter.username}</span>}
        </p>
        <p style={text(12)}>A mesma partida. Um Passaporte para cada torcedor.</p>
      </div>
    </div>
  );
}

export function Reassurance() {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <ShieldCheck size={14} color={MUTED} />
      <p style={text(11, MUTED, { lineHeight: "normal" })}>Seus dados ficam seguros no tripsz.</p>
    </div>
  );
}
