"use client";
import { useEffect, useState } from "react";
import { MapPin, PanelLeft, Plus, Search } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase";
import { BORDER, FONT_DISPLAY, GREEN } from "../../lib/tokens";
import { initials } from "../../lib/textUtils";

/**
 * Barra de baixo do APP (só depois de logado): Home · Explorar · (+) adicionar jogo · Estádios · Perfil.
 * Jogos, Assinatura, Conquistas, Roteiros e Ranking ficam nas abas do topo (AuthedNav).
 */
const HOME = ["buscar"];
const EXPLORE = ["calendario"];
const ADD = ["registrar-jogo"];
const PROFILE = ["perfil"];

// Telas que mostram a barra: as da barra, as do topo e as extras (sino, boas-vindas).
export const TAB_SCREENS = new Set([
  ...HOME, ...EXPLORE, ...ADD, ...PROFILE,
  "jogos", "acompanhantes", "jogo-salvo", "assinatura", "conquistas", "nivel",
  "roteiros", "roteiro", "resultado", "ranking", "notificacoes", "bem-vindo",
]);
export const TAB_BAR_HEIGHT = 60;

export function BottomTabBar({ screen, onNavigate }) {
  const [me, setMe] = useState({ name: "", avatar: "" });
  useEffect(() => {
    let alive = true;
    supabaseBrowser().auth.getUser().then(({ data }) => {
      const m = data?.user?.user_metadata || {};
      if (alive) setMe({ name: m.full_name || m.name || data?.user?.email || "", avatar: m.avatar_url || m.picture || "" });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const item = (on, label, onClick, icon) => {
    const color = on ? GREEN : "#63738c";
    return (
      <div onClick={onClick} style={{ height: TAB_BAR_HEIGHT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}>
        {icon(color)}
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: on ? 700 : 500, fontSize: 10.5, color, margin: 0 }}>{label}</p>
      </div>
    );
  };

  return (
    <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 80, background: "#fff", borderTop: `1px solid ${BORDER}`, borderRadius: "20px 20px 0 0", paddingBottom: "env(safe-area-inset-bottom)", display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
      {item(HOME.includes(screen), "Home", () => onNavigate("buscar"), (c) => <PanelLeft size={22} color={c} strokeWidth={2} />)}
      {item(EXPLORE.includes(screen), "Explorar", () => onNavigate("calendario"), (c) => <Search size={22} color={c} strokeWidth={2} />)}
      <div onClick={() => onNavigate("registrar-jogo")} role="button" aria-label="Adicionar jogo" style={{ height: TAB_BAR_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: ADD.includes(screen) ? "0 0 0 4px rgba(0,200,83,0.25)" : "0 4px 10px rgba(0,200,83,0.35)" }}>
          <Plus size={26} color="#fff" strokeWidth={2.6} />
        </div>
      </div>
      {item(false, "Estádios", () => { window.location.href = "/estadios"; }, (c) => <MapPin size={22} color={c} strokeWidth={2} />)}
      {item(PROFILE.includes(screen), "Perfil", () => onNavigate("perfil"), (c) => (
        <div style={{ width: 24, height: 24, borderRadius: 12, background: "#0f172a", boxShadow: PROFILE.includes(screen) ? `0 0 0 2px ${GREEN}` : "none", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {me.avatar ? <img src={me.avatar} alt="" width={24} height={24} style={{ width: 24, height: 24, objectFit: "cover" }} /> : <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 9, color: "#fff", margin: 0 }}>{initials(me.name)}</p>}
        </div>
      ))}
    </nav>
  );
}
