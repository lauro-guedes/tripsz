"use client";
import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_BG, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";

/** Barra de navegação de baixo do APP (só depois de logado). Os grupos abrem uma lista curta acima da barra. */
const TABS = [
  { id: "inicio", label: "Início", icon: "stadium", screens: ["buscar"] },
  { id: "jogos", label: "Meus jogos", icon: "soccerBall", screens: ["jogos", "registrar-jogo", "acompanhantes", "jogo-salvo"] },
  { id: "calendario", label: "Calendário", icon: null, screens: ["calendario"] },
  { id: "passaporte", label: "Passaporte", icon: "shieldBadge", screens: ["nivel", "conquistas", "ranking"], children: [["Nível de Torcedor", "nivel"], ["Meu Passaporte", "conquistas"], ["Ranking", "ranking"]] },
];

// Telas que mostram a barra mesmo sem aba própria (acessadas pelo menu da conta, no topo).
const EXTRA_SCREENS = ["roteiros", "roteiro", "resultado", "perfil", "notificacoes", "assinatura", "bem-vindo"];
export const TAB_SCREENS = new Set([...TABS.flatMap((t) => t.screens), ...EXTRA_SCREENS]);
export const TAB_BAR_HEIGHT = 60;

export function BottomTabBar({ screen, onNavigate }) {
  const [open, setOpen] = useState(null);
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
                </div>
              );
            })}
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
                {t.icon ? <Icon name={t.icon} size={22} color={color} /> : <CalendarDays size={22} color={color} strokeWidth={2} />}
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: on ? 700 : 500, fontSize: 10.5, color, margin: 0 }}>{t.label}</p>
            </div>
          );
        })}
      </nav>
    </>
  );
}
