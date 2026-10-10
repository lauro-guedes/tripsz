"use client";
import { countryKey } from "../../lib/countries";
import { FAN_LEVEL_TEXTS, XP_TIERS, computeTier } from "../../lib/fanLevels";
import { checkPassportAccess } from "../../lib/passportAccess";
import { supabaseBrowser } from "../../lib/supabase";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BG, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import { totalXp } from "../../lib/xpRules";
import { PHOTO_STADIUM } from "../landing/LandingPage";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";
import { Loading } from "../ui/Loading";
import { useIsMobile } from "../ui/useIsMobile";
import { PassportPaywall } from "./PassportPaywall";
import { useEffect, useState } from "react";

export function MeuNivel({ onNavigate, onLogout, onCreateNew }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [progress, setProgress] = useState(null);
  const [access, setAccess] = useState(null); // null = carregando

  useEffect(() => {
    (async () => {
      const acc = await checkPassportAccess();
      setAccess(acc);
      if (!acc.hasAccess) return;

      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      setUserName(user?.user_metadata?.name || user?.email || "");
      setUserAvatar(user?.user_metadata?.avatar_url || null);

      // Só jogos REGISTRADOS de verdade contam pra XP — gerar um roteiro
      // sugerido é só uma sugestão de viagem, não uma confirmação de que
      // a pessoa foi ao jogo, então não deveria valer conquista.
      const { data: attendedRows } = await supabase.from("attended_games").select("*");
      const attended = attendedRows || [];

      const stadiums = new Set(attended.map((g) => g.stadium).filter(Boolean));
      const countries = new Set(attended.map((g) => countryKey(g.country)).filter(Boolean));
      const totalGames = attended.length;
      // O XP vem de lib/xpRules.js (a mesma fórmula de sempre, agora num lugar só — Meus Jogos mostra o XP de cada jogo).
      const xp = totalXp(attended);
      setProgress({ xp, totalGames, stadiums: stadiums.size, countries: countries.size });
    })();
  }, []);

  if (access === null) {
    return (
      <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
        <AuthedNav active="nivel" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <Loading />
      </div>
    );
  }
  if (!access.hasAccess) {
    return (
      <div style={{ background: BG, width: "100%" }}>
        <AuthedNav active="nivel" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <PassportPaywall userId={access.userId} userEmail={access.userEmail} userName={userName} userAvatar={userAvatar} onCreateNew={onCreateNew} />
        <AuthedFooter />
      </div>
    );
  }

  const xp = progress?.xp ?? 0;
  const tier = computeTier(xp);
  const nextTier = XP_TIERS[tier.level] || null;
  const tierSpan = tier.max === Infinity ? xp - tier.min || 1 : tier.max - tier.min + 1;
  const xpIntoTier = xp - tier.min;
  const pct = tier.max === Infinity ? 100 : Math.min(100, Math.round((xpIntoTier / tierSpan) * 100));

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="nivel" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ position: "relative", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 64, alignItems: "center", flexWrap: "wrap", padding: isMobile ? `32px ${px}` : `80px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <div style={{ position: "relative", flex: isMobile ? 1 : "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <Badge>Seu Progresso Atual</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 56, lineHeight: 1.05, color: TEXT, margin: 0 }}>Nível do Torcedor</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 22, lineHeight: 1.5, color: BODY, margin: 0 }}>{FAN_LEVEL_TEXTS.pageIntro}</p>
        </div>
        <div style={{ position: "relative", background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 16, padding: isMobile ? 20 : 32, width: isMobile ? "100%" : 420, maxWidth: "100%", flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>PROGRESSO DO PASSPORT</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: GREEN, margin: 0 }}>{xp} / {tier.max === Infinity ? xp : tier.max + 1} XP</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, color: TEXT, margin: 0 }}>Nível {tier.level} — {tier.name}</p>
            <div style={{ background: BORDER, height: 8, borderRadius: 4, width: "100%", overflow: "hidden" }}>
              <div style={{ background: GREEN, height: "100%", width: `${pct}%` }} />
            </div>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>
              {nextTier ? `Mais ${nextTier.min - xp} XP para atingir o nível ${nextTier.name}` : "Nível máximo atingido!"}
            </p>
          </div>
        </div>
      </div>

      <div style={{ background: BG_ALT, display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 40, padding: isMobile ? `24px ${px}` : `80px ${px}` }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 22 : 32, color: TEXT, margin: 0 }}>{FAN_LEVEL_TEXTS.sectionTitle}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[...XP_TIERS].reverse().map((t) => {
              const isCurrent = t.level === tier.level;
              const isLocked = t.level > tier.level;
              return (
                <div key={t.level} style={{ background: "#fff", border: isCurrent ? `2px solid ${GREEN}` : `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", gap: 16, alignItems: "center", opacity: isLocked ? 0.6 : 1 }}>
                  <div style={{ background: isCurrent ? GREEN_BG : BG_ALT, width: 44, height: 44, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name={t.icon} size={20} color={isCurrent ? GREEN : MUTED} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{t.name}</p>
                      <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>Nível {t.level} • {t.max === Infinity ? `${t.min}+ XP` : `${t.min}-${t.max} XP`}</p>
                    </div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: "2px 0 0" }}>{t.perk}</p>
                  </div>
                  {isCurrent && <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, margin: 0 }}>ATUAL</p>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ width: isMobile ? "100%" : 460, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Como ganhar XP</p>
            {[["Comparecer a um jogo", "+50 XP"], ["Visitar um novo estádio", "+100 XP"], ["Conhecer um novo país", "+200 XP"], ["Desbloquear uma conquista", "+150 XP"]].map(([l, v], i, arr) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: i < arr.length - 1 ? 12 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>{l}</p>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: "#fff", margin: 0 }}>Pronto para planejar sua próxima arquibancada?</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#e2e8f0", margin: 0 }}>Gere um roteiro inteligente personalizado com os melhores clássicos, derbies e sequências possíveis de jogos.</p>
            <div onClick={onCreateNew} style={{ background: GREEN_BUTTON, padding: "14px 24px", borderRadius: 8, textAlign: "center", cursor: "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", margin: 0 }}>Montar meu roteiro →</p>
            </div>
          </div>
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}
