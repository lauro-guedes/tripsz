"use client";
import { supabaseBrowser } from "../../lib/supabase";
import { initials } from "../../lib/textUtils";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, GOLD_BG, GREEN, GREEN_BG, MUTED, TEXT } from "../../lib/tokens";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav, AvatarCircle } from "../nav/AuthedNav";
import { Badge } from "../ui/Badge";
import { Loading } from "../ui/Loading";
import { useIsMobile } from "../ui/useIsMobile";
import { Award } from "lucide-react";
import { useEffect, useState } from "react";

export const TIER_MEDAL_COLORS = { 1: GOLD || "#b78103", 2: "#6b7280", 3: "#cd7f32" };

export const TIER_MEDAL_BG = { 1: "#fff9e6", 2: "#f1f5f9", 3: "#fdf4e5" };

export function PodiumSpot({ entry, position }) {
  const isMobile = useIsMobile();
  const color = TIER_MEDAL_COLORS[position];
  const bg = TIER_MEDAL_BG[position];
  const isFirst = position === 1;
  const avatarSize = isMobile ? (isFirst ? 52 : 44) : (isFirst ? 88 : 72);
  const blockHeight = isMobile ? (isFirst ? 120 : position === 2 ? 90 : 70) : (isFirst ? 220 : position === 2 ? 160 : 130);
  const initials = (entry.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 16, alignItems: "center", flex: 1, minWidth: 0 }}>
      {isFirst && <Award size={isMobile ? 16 : 32} color={color} />}
      <div style={{ border: `${isFirst ? 3 : 2}px solid ${color}`, borderRadius: 999, padding: isFirst ? 4 : 3, display: "flex" }}>
        <div style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: avatarSize * 0.3, color: TEXT, margin: 0 }}>{initials}</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: isFirst ? 800 : 700, fontSize: isMobile ? (isFirst ? 13 : 12) : (isFirst ? 20 : 18), color: TEXT, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{isMobile ? entry.name.split(" ")[0] : entry.name}</p>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: isMobile ? (isFirst ? 11 : 10) : (isFirst ? 16 : 14), color, margin: 0 }}>{entry.xp.toLocaleString("pt-BR")} XP</p>
        {!isMobile && (
          <div style={{ background: bg, padding: "4px 8px", borderRadius: 4 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color, margin: 0 }}>{entry.tier.toUpperCase()}</p>
          </div>
        )}
      </div>
      <div style={{ background: bg, width: "100%", height: blockHeight, borderRadius: "12px 12px 0 0", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: position === 1 ? "flex-start" : "flex-end", paddingBottom: position === 1 ? 0 : 12, paddingTop: 12 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: isMobile ? (isFirst ? 32 : 20) : (isFirst ? 64 : 40), color, margin: 0 }}>{position}</p>
        {!isFirst && <Award size={isMobile ? 14 : 24} color={color} />}
      </div>
    </div>
  );
}

export function RankingRow({ entry, highlighted, isMobile }) {
  const tierColors = { "Lenda": GOLD, "Veterano": "#6b7280", "Groundhopper": GREEN, "Estreante": MUTED, "Torcedor de Sofá": MUTED };
  const tierBg = { "Lenda": GOLD_BG, "Veterano": "#f1f5f9", "Groundhopper": GREEN_BG, "Estreante": "#f1f5f9", "Torcedor de Sofá": "#f1f5f9" };
  const color = tierColors[entry.tier] || MUTED;
  const bg = tierBg[entry.tier] || "#f1f5f9";
  const initials = (entry.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  if (isMobile) {
    return (
      <div style={{ background: highlighted ? "rgba(0,200,83,0.03)" : "#fff", border: highlighted ? `2px solid ${GREEN}` : "none", borderBottom: highlighted ? "none" : `1px solid ${BORDER}`, borderRadius: highlighted ? 12 : 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: highlighted ? GREEN : MUTED, margin: 0, width: 28 }}>#{entry.position}</p>
          <AvatarCircle url={highlighted ? entry.avatarUrl : null} name={entry.name} size={highlighted ? 32 : 24} fontSize={11} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: highlighted ? GREEN : color, margin: 0, textTransform: highlighted ? "uppercase" : "none" }}>{highlighted ? "Sua posição atual" : entry.tier}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: highlighted ? GREEN : TEXT, margin: 0 }}>{entry.xp.toLocaleString("pt-BR")} XP</p>
          <p style={{ fontSize: 16, margin: 0 }}>{entry.flag}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: highlighted ? "rgba(0,200,83,0.03)" : "transparent", border: highlighted ? `2px solid ${GREEN}` : "none", borderRadius: highlighted ? 12 : 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
      <div style={{ display: "flex", gap: 24, alignItems: "center", width: 300 }}>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: highlighted ? 16 : 15, color: highlighted ? GREEN : MUTED, margin: 0 }}>#{entry.position}</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <AvatarCircle url={highlighted ? entry.avatarUrl : null} name={entry.name} size={highlighted ? 36 : 32} fontSize={14} />
          <div>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: highlighted ? 15 : 15, color: TEXT, margin: 0 }}>{entry.name}</p>
            {highlighted && <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>Sua posição atual</p>}
          </div>
        </div>
      </div>
      <div style={{ width: 150 }}>
        <div style={{ background: bg, display: "inline-flex", padding: "4px 10px", borderRadius: 4 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color, margin: 0 }}>{entry.tier.toUpperCase()}</p>
        </div>
      </div>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: highlighted ? 16 : 14, color: highlighted ? GREEN : TEXT, margin: 0, width: 120, textAlign: "right" }}>{entry.xp.toLocaleString("pt-BR")} XP</p>
      <p style={{ fontSize: 20, margin: 0, width: 80, textAlign: "center" }}>{entry.flag}</p>
    </div>
  );
}

export function RankingTorcedores({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [scope, setScope] = useState("nacional");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      setUserName(userData.user?.user_metadata?.name || userData.user?.email || "");
      setUserAvatar(userData.user?.user_metadata?.avatar_url || null);

      setLoading(true);
      try {
        const res = await fetch(`/api/ranking?userId=${userData.user?.id}&scope=${scope}`);
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    })();
  }, [scope]);

  const podium = data?.podium || [];
  const rest = data?.rest || [];
  const myEntry = data?.myEntry;
  const myInTop15 = rest.some((e) => e.userId === myEntry?.userId) || podium.some((e) => e.userId === myEntry?.userId);

  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <AuthedNav active="ranking" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
      <div style={{ padding: isMobile ? `24px ${px}` : `64px 120px`, display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 24 }}>
          <Badge>Comunidade tripsz</Badge>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: isMobile ? "100%" : 700 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: isMobile ? 28 : 40, color: TEXT, margin: 0 }}>Ranking de Torcedores</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, lineHeight: 1.5, color: BODY, margin: 0 }}>Compare seu passaporte com outros viajantes e dispute a liderança no ranking nacional.</p>
            </div>
            <div style={{ background: BORDER, padding: 4, borderRadius: 8, display: "flex", width: isMobile ? "100%" : "auto" }}>
              {[["nacional", "Nacional"], ["global", "Global"]].map(([key, label]) => (
                <div key={key} onClick={() => setScope(key)} style={{ flex: isMobile ? 1 : "none", background: scope === key ? GREEN : "transparent", padding: "10px 24px", borderRadius: 6, textAlign: "center", cursor: "pointer" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: scope === key ? 700 : 500, fontSize: isMobile ? 13 : 14, color: scope === key ? "#fff" : MUTED, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <Loading text="Carregando ranking..." compact />
        ) : podium.length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 40, textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: MUTED, margin: 0 }}>Ainda estamos reunindo torcedores suficientes pro ranking {scope === "nacional" ? "nacional" : "global"} — volte em breve!</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: isMobile ? 8 : 24, alignItems: "flex-end", justifyContent: "center", width: "100%" }}>
              {podium[1] && <PodiumSpot entry={podium[1]} position={2} />}
              {podium[0] && <PodiumSpot entry={podium[0]} position={1} />}
              {podium[2] && <PodiumSpot entry={podium[2]} position={3} />}
            </div>

            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
                  {rest.map((e) => <RankingRow key={e.userId} entry={e} highlighted={false} isMobile />)}
                </div>
                {myEntry && !myInTop15 && <RankingRow entry={myEntry} highlighted isMobile />}
              </div>
            ) : (
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 24px", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ display: "flex", gap: 24, width: 300 }}>
                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: MUTED, margin: 0 }}>POSIÇÃO</p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, margin: 0 }}>TORCEDOR</p>
                  </div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, margin: 0, width: 150 }}>CATEGORIA</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, margin: 0, width: 120, textAlign: "right" }}>PONTUAÇÃO</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, margin: 0, width: 80, textAlign: "center" }}>PAÍS</p>
                </div>
                {rest.map((e, i) => <RankingRow key={e.userId} entry={e} highlighted={false} isMobile={false} />)}
                {myEntry && !myInTop15 && <div style={{ marginTop: 8 }}><RankingRow entry={myEntry} highlighted isMobile={false} /></div>}
              </div>
            )}
          </>
        )}
      </div>
      <AuthedFooter />
    </div>
  );
}
