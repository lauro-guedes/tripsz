"use client";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { text } from "../convite/ConviteUi";
import { XP_TIERS, computeTier } from "../../lib/fanLevels";
import { supabaseBrowser } from "../../lib/supabase";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { ScreenHeader } from "../social/ui";

/** As abas da Jornada. A chave é a própria tela (assim cada aba tem o seu endereço e o botão voltar funciona). */
export const JORNADA_TABS = [["calendario", "Calendário"], ["roteiros", "Roteiros"], ["jogos", "Histórico de jogos"]];
export const xpLabel = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString("pt-BR");

/** Onde a pessoa está na escada de níveis: o nível, quanto já andou (%) e quanto falta pro próximo (`next` null = nível máximo). */
export function nextLevelInfo(xpRaw) {
  const xp = Number.isFinite(Number(xpRaw)) && Number(xpRaw) > 0 ? Number(xpRaw) : 0;
  const cur = computeTier(xp);
  const next = XP_TIERS.find((t) => t.level === cur.level + 1) || null;
  if (!next) return { cur, next: null, pct: 100, missing: 0, xp };
  return { cur, next, pct: Math.max(0, Math.min(100, Math.round(((xp - cur.min) / (next.min - cur.min)) * 100))), missing: next.min - xp, xp };
}

/** O cartão "Você": posição no ranking, nível, XP e quanto falta pro próximo nível. Toque no cartão abre o Ranking; "Ver meu nível" abre o Meu nível. */
function VoceCard({ onNavigate }) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabaseBrowser().auth.getUser();
        const id = data && data.user && data.user.id;
        if (!id) throw new Error("sem sessão");
        const res = await fetch(`/api/ranking?userId=${id}&scope=nacional`);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error("ranking");
        if (alive) setState({ status: "ready", entry: json.myEntry || null });
      } catch {
        if (alive) setState({ status: "error" });
      }
    })();
    return () => { alive = false; };
  }, []);

  const box = { margin: "0 16px 14px", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, padding: 16 };
  if (state.status === "loading") return <div style={box}><p style={text(13, MUTED)}>Carregando sua posição...</p></div>;
  if (state.status === "error") return <div style={box}><p style={text(13, MUTED)}>Não foi possível carregar sua posição agora.</p></div>;
  const entry = state.entry;
  const lv = nextLevelInfo(entry ? entry.xp : 0);
  return (
    <div role="button" aria-label="Ver ranking" onClick={() => onNavigate("ranking")} style={{ ...box, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ background: "rgba(0,200,83,0.12)", color: GREEN_DARK, borderRadius: 999, padding: "4px 10px", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 11 }}>VOCÊ</span>
        <span role="button" aria-label="Ver meu nível" onClick={(e) => { e.stopPropagation(); onNavigate("nivel"); }} style={{ display: "inline-flex", alignItems: "center", gap: 2, cursor: "pointer", padding: "4px 0 4px 8px" }}><span style={text(12, GREEN_DARK, { fontWeight: 700 })}>Ver meu nível</span><ChevronRight size={16} color={GREEN_DARK} /></span>
      </div>
      <div>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, color: TEXT, margin: 0 }}>{entry ? `#${entry.position} no ranking` : "Sem posição ainda"}</p>
        <p style={text(14, MUTED)}>{lv.cur.name} · {xpLabel(lv.xp)} XP</p>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0" }}><div style={{ width: `${lv.pct}%`, height: "100%", borderRadius: 3, background: GREEN }} /></div>
      <p style={text(12, MUTED)}>{!entry ? "Registre um jogo para entrar no ranking." : lv.next ? `Faltam ${xpLabel(lv.missing)} XP para ${lv.next.name}` : "Você está no nível mais alto."}</p>
    </div>
  );
}

/** O topo da Jornada (a aba do meio da barra): título, o cartão "Você" e as abas Calendário | Roteiros | Histórico de jogos. */
export function JornadaHeader({ tab, onTab, onNavigate }) {
  return (
    <div style={{ background: "#f8fafc" }}>
      <ScreenHeader title="Jornada" />
      <VoceCard onNavigate={onNavigate} />
      <div style={{ padding: "0 16px 6px" }}>
        <div role="tablist" aria-label="Jornada" style={{ display: "flex", background: "#eef2f6", borderRadius: 12, padding: 4, gap: 4 }}>
          {JORNADA_TABS.map(([id, label]) => (
            <div key={id} role="tab" aria-selected={tab === id} onClick={() => tab !== id && onTab(id)} style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 9, cursor: "pointer", background: tab === id ? "#fff" : "transparent" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: tab === id ? GREEN_DARK : MUTED, margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
