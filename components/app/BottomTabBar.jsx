"use client";
import { useEffect, useState } from "react";
import { PanelLeft, Plus, Route } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase";
import { BORDER, FONT_DISPLAY, GREEN } from "../../lib/tokens";
import { initials } from "../../lib/textUtils";
import { Icon } from "../ui/Icon";

/**
 * Barra de baixo do APP (só depois de logado): Início (o feed) · Estádios · (+) Central · Jornada (ranking, calendário e roteiros) · Perfil.
 * O "+" abre a Central (check-in, jogo passado ou publicação). Conquistas, Histórico de jogos, Assinatura e Amigos ficam dentro do Perfil.
 */
const HOME = ["feed", "notificacoes", "publicacao", "buscar"]; // "buscar" (Buscar jogos) abre pelo "Ver jogos" do Início
const STADIUMS = ["estadios", "estadio", "jogo-ao-vivo"];
const ADD = ["central", "checkin", "post-novo", "registrar-jogo", "jogo-salvo", "acompanhantes"];
const JORNADA = ["jornada", "ranking", "calendario", "roteiros", "roteiro", "resultado", "nivel"]; // o cartão "Você" abre o Meu nível
const PROFILE = ["perfil", "usuario", "perfil-editar", "perfil-dados", "amigos", "conquistas", "jogos", "assinatura"];

// Telas que mostram a barra: as da barra e as que continuam existindo no app sem ter aba (roteiros, buscar, calendário...).
export const TAB_SCREENS = new Set([...HOME, ...STADIUMS, ...ADD, ...JORNADA, ...PROFILE, "buscar", "bem-vindo"]);
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

  const item = (on, label, target, icon) => {
    const color = on ? "#008a3a" : "#63738c";
    return (
      <div role="button" aria-label={label} aria-current={on ? "page" : undefined} onClick={() => onNavigate(target)} style={{ height: TAB_BAR_HEIGHT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
        <div style={{ width: 56, height: 30, borderRadius: 15, background: on ? "rgba(0,200,83,0.14)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon(color)}</div>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: on ? 700 : 500, fontSize: 10.5, color, margin: 0 }}>{label}</p>
      </div>
    );
  };

  return (
    <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 80, background: "#fff", borderTop: `1px solid ${BORDER}`, borderRadius: "20px 20px 0 0", paddingBottom: "env(safe-area-inset-bottom)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", alignItems: "center", boxShadow: "0 -4px 16px rgba(15,23,42,0.04)" }}>
      {item(HOME.includes(screen), "Início", "feed", (c) => <PanelLeft size={22} color={c} strokeWidth={2} />)}
      {item(STADIUMS.includes(screen), "Estádios", "estadios", (c) => <Icon name="stadium" size={22} color={c} />)}
      <div onClick={() => onNavigate("central")} role="button" aria-label="Adicionar" style={{ height: TAB_BAR_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: ADD.includes(screen) ? "0 0 0 4px rgba(0,200,83,0.2)" : "0 4px 10px rgba(0,200,83,0.3)" }}>
          <Plus size={26} color="#fff" strokeWidth={2.6} />
        </div>
      </div>
      {item(JORNADA.includes(screen), "Jornada", "jornada", (c) => <Route size={22} color={c} strokeWidth={2} />)}
      {item(PROFILE.includes(screen), "Perfil", "perfil", () => (
        <div style={{ width: 24, height: 24, borderRadius: 12, background: "#0f172a", boxShadow: PROFILE.includes(screen) ? `0 0 0 2px ${GREEN}` : "none", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {me.avatar ? <img src={me.avatar} alt="" width={24} height={24} style={{ width: 24, height: 24, objectFit: "cover" }} /> : <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 9, color: "#fff", margin: 0 }}>{initials(me.name)}</p>}
        </div>
      ))}
    </nav>
  );
}
