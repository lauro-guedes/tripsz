"use client";
import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { countryKey } from "../../lib/countries";
import { computeTier } from "../../lib/fanLevels";
import { supabaseBrowser } from "../../lib/supabase";
import { initials } from "../../lib/textUtils";
import { totalXp } from "../../lib/xpRules";
import { BORDER, FONT_DISPLAY, FONT_MONO, GOLD, GREEN, GREEN_BUTTON2, MUTED, TEXT } from "../../lib/tokens";

/**
 * Topo do Início do app: cartão "Passaporte de Estádios" (foto, nome, nível, ID) e, abaixo, as 4 estatísticas.
 * Mesmas contas da tela Meu Passaporte (jogos registrados de verdade).
 */
export function HomeStats({ onOpen }) {
  const [stats, setStats] = useState(null);
  const [me, setMe] = useState({ name: "", avatar: "", id: "", year: new Date().getFullYear() });

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = supabaseBrowser();
      try {
        const { data: u } = await supabase.auth.getUser();
        const user = u?.user;
        const m = user?.user_metadata || {};
        if (alive && user) setMe({ name: m.full_name || m.name || user.email || "", avatar: m.avatar_url || m.picture || "", id: user.id, year: new Date(user.created_at || Date.now()).getFullYear() });
        const { data } = await supabase.from("attended_games").select("id, match_date, created_at, stadium, country, competition");
        const rows = data || [];
        if (!alive) return;
        setStats({
          stadiums: new Set(rows.map((g) => g.stadium).filter(Boolean)).size,
          countries: new Set(rows.map((g) => countryKey(g.country)).filter(Boolean)).size,
          games: rows.length,
          competitions: new Set(rows.map((g) => g.competition || "domestica")).size,
          xp: totalXp(rows),
        });
      } catch {
        if (alive) setStats({ stadiums: 0, countries: 0, games: 0, competitions: 0, xp: 0 });
      }
    })();
    return () => { alive = false; };
  }, []);

  const level = computeTier(stats?.xp ?? 0).name.toUpperCase();
  const items = [["stadiums", "Estádios", "visitados"], ["countries", "Países", "conquistados"], ["games", "Jogos", "assistidos"], ["competitions", "Competições", "diferentes"]];
  const label = { fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 };

  return (
    <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
      <div onClick={onOpen} role="button" style={{ background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 24, padding: 20, cursor: "pointer", display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 8px 20px rgba(0,200,83,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: TEXT, margin: 0, letterSpacing: 0.2 }}>PASSAPORTE DE ESTÁDIOS</p>
          <Award size={28} color={GREEN} strokeWidth={2} />
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 76, height: 96, borderRadius: 12, background: GREEN_BUTTON2, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {me.avatar ? <img src={me.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, color: "#fff", margin: 0 }}>{initials(me.name)}</p>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <div>
              <p style={label}>Nome do titular</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, color: TEXT, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis" }}>{me.name || "—"}</p>
            </div>
            <div>
              <p style={label}>Nível de acesso</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: GREEN, margin: "2px 0 0" }}>{stats ? level : "—"}</p>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>ID: #{me.id ? me.id.slice(0, 4).toUpperCase() : "----"}-MD</p>
          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>ATIVAÇÃO: {me.year}</p>
        </div>
      </div>

      <div onClick={onOpen} role="button" style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 24, padding: "20px 8px", cursor: "pointer", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {items.map(([key, a, b]) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "0 2px" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 30, lineHeight: 1.1, color: GREEN, margin: 0 }}>{stats ? stats[key] : "—"}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 8.5, lineHeight: 1.4, color: MUTED, margin: 0, textAlign: "center", textTransform: "uppercase" }}>{a}<br />{b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
