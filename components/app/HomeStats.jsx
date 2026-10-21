"use client";
import { useEffect, useState } from "react";
import { countryKey } from "../../lib/countries";
import { supabaseBrowser } from "../../lib/supabase";
import { BORDER, FONT_DISPLAY, FONT_MONO, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";

/** Resumo do Passaporte no topo do Início do app: mesmas contas da tela Meu Passaporte (jogos registrados de verdade). */
export function HomeStats({ onOpen }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabaseBrowser().from("attended_games").select("stadium, country, competition");
        const rows = data || [];
        if (!alive) return;
        setStats({
          stadiums: new Set(rows.map((g) => g.stadium).filter(Boolean)).size,
          countries: new Set(rows.map((g) => countryKey(g.country)).filter(Boolean)).size,
          games: rows.length,
          competitions: new Set(rows.map((g) => g.competition || "domestica")).size,
        });
      } catch {
        if (alive) setStats({ stadiums: 0, countries: 0, games: 0, competitions: 0 });
      }
    })();
    return () => { alive = false; };
  }, []);

  const items = [["stadiums", "Estádios", "visitados"], ["countries", "Países", "conquistados"], ["games", "Jogos", "assistidos"], ["competitions", "Competições", "diferentes"]];

  return (
    <div onClick={onOpen} role="button" style={{ margin: "16px 16px 0", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: "16px 8px 14px", cursor: "pointer", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 12px" }}>
        <Icon name="shieldBadge" size={18} color={GREEN} />
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0, flex: 1 }}>Seu Passaporte</p>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 12, color: GREEN, margin: 0 }}>Ver tudo</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {items.map(([key, label, sub], k) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, borderLeft: k ? `1px solid ${BORDER}` : "none", padding: "0 2px" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, lineHeight: 1.1, color: GREEN, margin: 0 }}>{stats ? stats[key] : "—"}</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: TEXT, margin: 0, textAlign: "center" }}>{label}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 9, color: MUTED, margin: 0, textAlign: "center" }}>{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
