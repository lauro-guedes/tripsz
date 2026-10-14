"use client";
import { BookOpen, CheckCircle2, MapPin, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { countryKey } from "../../lib/countries";
import { formatShortDate } from "../../lib/gameDetailsCore";
import { clearWelcome, readWelcome } from "../../lib/pendingInvite";
import { supabaseBrowser } from "../../lib/supabase";
import { teamLabel } from "../../lib/textUtils";
import { BG, BORDER, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { useIsMobile } from "../ui/useIsMobile";

const TINT = "#e8faef";
const t = (size, color = MUTED, extra) => ({ fontFamily: FONT_DISPLAY, fontSize: size, lineHeight: 1.45, color, margin: 0, ...extra });
const mono = (size, color = MUTED) => ({ fontFamily: FONT_MONO, fontSize: size, lineHeight: 1.4, color, margin: 0, textTransform: "uppercase" });
const card = { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12 };

function Milestone({ value, label }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={t(26, GREEN, { fontWeight: 800, lineHeight: "normal" })}>{value}</p>
      <p style={{ ...mono(9), marginTop: 4 }}>{label}</p>
    </div>
  );
}

/**
 * Tela de boas-vindas de quem acabou de resgatar um convite: o jogo já está no Passaporte.
 * Os dados vêm do resgate (guardados no navegador por lib/pendingInvite.js); sem eles, volta pra Meus Jogos.
 */
export function BoasVindasConvite({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const [welcome] = useState(() => readWelcome());
  const [user, setUser] = useState({ name: "", avatar: null, first: "" });
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!welcome) {
      onNavigate("jogos");
      return;
    }
    (async () => {
      const supabase = supabaseBrowser();
      const { data: u } = await supabase.auth.getUser();
      const meta = (u.user && u.user.user_metadata) || {};
      const full = meta.name || (u.user && u.user.email) || "";
      setUser({ name: full, avatar: meta.avatar_url || null, first: String(meta.first_name || full).trim().split(/\s+/)[0] || "" });
      const { data: games } = await supabase.from("attended_games").select("stadium, country");
      const list = games || [];
      setCounts({ games: list.length, stadiums: new Set(list.map((g) => g.stadium).filter(Boolean)).size, countries: new Set(list.map((g) => countryKey(g.country)).filter(Boolean)).size });
    })();
  }, []);

  if (!welcome) return null;
  const { game, inviter, duplicate } = welcome;
  const inv = (inviter && inviter.firstName) || "um amigo";
  const first = user.first;
  const isFirst = !!counts && counts.games === 1;
  const px = isMobile ? "20px" : "140px";
  const hasScore = game.home_score != null && game.away_score != null;
  const title = `${teamLabel(game.home_team)} ${hasScore ? `${game.home_score}×${game.away_score}` : "×"} ${teamLabel(game.away_team)}`;
  const label = [game.competition, formatShortDate(game.match_date)].filter(Boolean).join(" · ");
  const place = [game.stadium, game.city].filter(Boolean).join(" · ");
  const where = [game.city, game.country].filter(Boolean).join(", ");
  const go = (screen) => {
    clearWelcome();
    onNavigate(screen);
  };

  const heading = duplicate ? `Esse jogo já estava com você${first ? `, ${first}` : ""}` : isFirst ? `Seu Passaporte começou${first ? `, ${first}` : ""}!` : `Mais uma lembrança no seu Passaporte${first ? `, ${first}` : ""}!`;
  const sub = duplicate ? `O convite de ${inv} foi resgatado, mas você já tinha esse jogo. Nada foi duplicado.` : `O convite de ${inv} foi resgatado. A lembrança ${game.stadium ? `do ${game.stadium}` : "desse jogo"} já é parte da sua história.`;
  const banner = duplicate ? ["Você já tinha esse jogo.", "Ele continua no seu Passaporte; o convite não criou outro registro."] : ["Convite resgatado. Jogo guardado.", isFirst ? "Seu primeiro carimbo no Passaporte de Estádios." : "Mais um carimbo no seu Passaporte de Estádios."];
  const n = (v) => (counts ? v : "–");

  const gameCard = (
    <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {label && <p style={mono(10)}>{label}</p>}
      <p style={t(18, TEXT, { fontWeight: 700 })}>{title}</p>
      {place && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <MapPin size={16} color={MUTED} />
          <p style={t(13, MUTED, { lineHeight: "normal" })}>{place}</p>
        </div>
      )}
      {!duplicate && (
        <div style={{ background: TINT, borderRadius: 12, padding: "5px 9px", alignSelf: "flex-start" }}>
          <p style={t(10, GREEN_DARK, { fontFamily: FONT_MONO, fontWeight: 700, lineHeight: "normal" })}>Veio por convite de {inv}</p>
        </div>
      )}
    </div>
  );
  const next = (
    <div style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={t(16, TEXT, { fontWeight: 700 })}>A próxima lembrança é com você</p>
      <p style={t(13)}>Registre os outros jogos em que esteve. E marque quem cantou junto na arquibancada.</p>
    </div>
  );
  const summary = (
    <div style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 16, width: isMobile ? "100%" : 300, boxSizing: "border-box", flexShrink: 0 }}>
      <BookOpen size={28} color={GREEN_DARK} />
      <p style={mono(10)}>Seu Passaporte de Estádios</p>
      <div style={{ display: "flex", gap: 12 }}>
        <Milestone value={n(counts && counts.games)} label={counts && counts.games !== 1 ? "Jogos" : "Jogo"} />
        <Milestone value={n(counts && counts.stadiums)} label={counts && counts.stadiums !== 1 ? "Estádios" : "Estádio"} />
        <Milestone value={n(counts && counts.countries)} label={counts && counts.countries !== 1 ? "Países" : "País"} />
      </div>
      {where && <div style={{ background: BORDER, height: 1 }} />}
      {where && <p style={t(12)}>{isFirst ? "Primeira parada" : "Este jogo"}: {where}.</p>}
    </div>
  );
  const buttons = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: isMobile ? "100%" : 360, alignSelf: isMobile ? "stretch" : "flex-end" }}>
      <div role="button" onClick={() => go("jogos")} style={{ background: GREEN, border: `1px solid ${GREEN}`, borderRadius: 12, height: 48, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <p style={t(13, TEXT, { fontWeight: 700, lineHeight: "normal" })}>{isFirst ? "Ver meu primeiro jogo" : "Ver meus jogos"}</p>
      </div>
      <div role="button" onClick={() => go("registrar-jogo")} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, height: 48, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <Plus size={16} color={TEXT} />
        <p style={t(13, TEXT, { fontWeight: 700, lineHeight: "normal" })}>Registrar outro jogo</p>
      </div>
    </div>
  );

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="jogos" userName={user.name} userAvatar={user.avatar} onNavigate={onNavigate} onLogout={onLogout} />
      <div style={{ padding: `${isMobile ? 24 : 40}px ${px} 48px`, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={mono(10)}>{isFirst ? "Boas-vindas ao tripsz" : "Convite resgatado"}</p>
          <h1 style={t(isMobile ? 26 : 32, TEXT, { fontWeight: 700, lineHeight: 1.3 })}>{heading}</h1>
          <p style={t(14)}>{sub}</p>
        </div>
        <div style={{ background: TINT, borderRadius: 12, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <CheckCircle2 size={24} color={GREEN_DARK} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <p style={t(14, TEXT, { fontWeight: 700 })}>{banner[0]}</p>
            <p style={t(12)}>{banner[1]}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={t(22, TEXT, { fontWeight: 700, lineHeight: "normal" })}>Meus Jogos</p>
              <div style={{ background: TINT, borderRadius: 12, padding: "5px 9px" }}>
                <p style={t(10, GREEN_DARK, { fontFamily: FONT_MONO, fontWeight: 700, lineHeight: "normal" })}>{counts ? `${counts.games} ${counts.games === 1 ? "jogo" : "jogos"}` : "–"}</p>
              </div>
            </div>
            {gameCard}
            {next}
          </div>
          {summary}
        </div>
        {buttons}
      </div>
      <AuthedFooter />
    </div>
  );
}
