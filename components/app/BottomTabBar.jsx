"use client";
import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { fetchCompanionRequests } from "../../lib/companionsClient";
import { BORDER, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BG, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";

/** Barra de navegação de baixo do APP (só depois de logado). Os grupos abrem uma lista curta acima da barra. */
const TABS = [
  { id: "roteiros", label: "Roteiros", icon: "planeTakeoff", screens: ["roteiros", "roteiro", "resultado"] },
  { id: "jogos", label: "Jogos", icon: "soccerBall", screens: ["jogos", "registrar-jogo", "acompanhantes", "jogo-salvo"] },
  { id: "buscar", label: "Buscar", icon: "search", screens: ["buscar", "calendario"], children: [["Buscar jogos", "buscar"], ["Meu Calendário", "calendario"]] },
  { id: "passaporte", label: "Passaporte", icon: "shieldBadge", screens: ["nivel", "conquistas", "ranking"], children: [["Nível de Torcedor", "nivel"], ["Meu Passaporte", "conquistas"], ["Ranking", "ranking"]] },
  { id: "conta", label: "Conta", icon: null, screens: ["perfil", "notificacoes", "assinatura", "bem-vindo"], children: [["Notificações", "notificacoes"], ["Meu perfil", "perfil"], ["Minha assinatura", "assinatura"]] },
];

export const TAB_SCREENS = new Set(TABS.flatMap((t) => t.screens));
export const TAB_BAR_HEIGHT = 60;

export function BottomTabBar({ screen, onNavigate, onLogout }) {
  const [open, setOpen] = useState(null);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => fetchCompanionRequests().then((r) => alive && r && r.ok && setNotifCount((r.requests || []).length));
    load();
    window.addEventListener("tripsz:notifs", load);
    return () => {
      alive = false;
      window.removeEventListener("tripsz:notifs", load);
    };
  }, []);

  useEffect(() => setOpen(null), [screen]);

  const go = (key) => { setOpen(null); onNavigate(key); };
  const group = TABS.find((t) => t.id === open);

  return (
    <>
      {group && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70 }} onClick={() => setOpen(null)}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.35)" }} />
          <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 12, right: 12, bottom: `calc(${TAB_BAR_HEIGHT + 8}px + env(safe-area-inset-bottom))`, background: "#fff", borderRadius: 16, border: `1px solid ${BORDER}`, boxShadow: "0 12px 32px rgba(15,23,42,0.2)", overflow: "hidden" }}>
            {group.children.map(([label, key]) => {
              const on = screen === key;
              return (
                <div key={key} onClick={() => go(key)} style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, background: on ? GREEN_BG : "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: on ? 700 : 500, fontSize: 15, color: on ? GREEN : TEXT, margin: 0 }}>{label}</p>
                  {key === "notificacoes" && notifCount > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 999, minWidth: 20, height: 20, padding: "0 6px", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11 }}>{notifCount}</span>}
                </div>
              );
            })}
            {group.id === "conta" && (
              <div onClick={() => { setOpen(null); onLogout(); }} style={{ padding: "16px 20px" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: "#dc2626", margin: 0 }}>Sair</p>
              </div>
            )}
          </div>
        </div>
      )}
      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 80, background: "#fff", borderTop: `1px solid ${BORDER}`, paddingBottom: "env(safe-area-inset-bottom)", display: "grid", gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
        {TABS.map((t) => {
          const on = t.screens.includes(screen) || open === t.id;
          const color = on ? GREEN : "#63738c";
          return (
            <div key={t.id} onClick={() => (t.children ? setOpen(open === t.id ? null : t.id) : go(t.screens[0]))} style={{ height: TAB_BAR_HEIGHT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", position: "relative" }}>
              <div style={{ position: "relative", display: "flex" }}>
                {t.icon ? <Icon name={t.icon} size={22} color={color} /> : <User size={22} color={color} strokeWidth={2} />}
                {t.id === "conta" && notifCount > 0 && <span style={{ position: "absolute", top: -3, right: -6, width: 10, height: 10, borderRadius: 5, background: "#ef4444", border: "2px solid #fff" }} />}
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: on ? 700 : 500, fontSize: 10.5, color, margin: 0 }}>{t.label}</p>
            </div>
          );
        })}
      </nav>
    </>
  );
}
