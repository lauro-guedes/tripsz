"use client";
import { Award } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { text } from "../convite/ConviteUi";
import { loadBadgeContext } from "../../lib/badgeContext";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { computeBadgeCategories } from "../conta/MinhasConquistas";
import { EmptyState, SmallBtn } from "./ui";

const SHOWN = 9; // quantos selos aparecem no perfil; o resto fica em "Ver todas as conquistas"

/** A aba Conquistas do MEU perfil: quantas já tenho e os selos conquistados (a conta é a mesma da tela Conquistas). */
export function ConquistasTab({ onNavigate }) {
  const [state, setState] = useState({ status: "loading" });
  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const ctx = await loadBadgeContext();
      if (!ctx) return setState({ status: "error" });
      const all = computeBadgeCategories(ctx).flatMap((c) => c.badges);
      setState({ status: "ready", total: all.length, unlocked: all.filter((b) => b.unlocked) });
    } catch {
      setState({ status: "error" });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (state.status === "loading") return <EmptyState title="Carregando conquistas..." />;
  if (state.status === "error")
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "12px 16px 20px" }}>
        <EmptyState title="Não foi possível carregar as conquistas" body="Tente de novo em instantes." />
        <SmallBtn onClick={load}>Tentar de novo</SmallBtn>
      </div>
    );
  const { total, unlocked } = state;
  const shown = unlocked.slice(0, SHOWN);
  return (
    <div style={{ padding: "14px 16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={text(15, TEXT, { fontWeight: 800 })}>{unlocked.length} de {total} conquistas</p>
        <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0", marginTop: 8 }}>
          <div style={{ width: `${total ? Math.round((unlocked.length / total) * 100) : 0}%`, height: "100%", borderRadius: 3, background: GREEN }} />
        </div>
      </div>
      {unlocked.length === 0 ? (
        <EmptyState title="Nenhuma conquista ainda" body="Registre jogos e faça check-ins para desbloquear seus primeiros selos." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {shown.map((b) => (
            <div key={b.id} aria-label={`Conquista ${b.label}`} style={{ border: `1px solid ${GREEN}`, borderRadius: 14, padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(0,200,83,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><Award size={20} color={GREEN_DARK} /></div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: TEXT, margin: 0 }}>{b.label}</p>
            </div>
          ))}
        </div>
      )}
      {unlocked.length > SHOWN && <p style={text(12, MUTED)}>E mais {unlocked.length - SHOWN} conquistadas.</p>}
      <div style={{ display: "flex", justifyContent: "center" }}><SmallBtn kind="outline" onClick={() => onNavigate("conquistas")}>Ver todas as conquistas</SmallBtn></div>
    </div>
  );
}
