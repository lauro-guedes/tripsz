"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "../../lib/authFetch";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import TeamBadge from "../TeamBadge";
import { PartidaAoVivo } from "./PartidaAoVivo";
import { EmptyState } from "./ui";

const REFRESH_MS = 30_000;
const LIVE_RED = "#e11d48";
const FIRST = [71, 72, 73, 13, 11, 2, 3, 848]; // Brasil e continentais primeiro

/** Agrupa por liga: Brasil e continentais no topo, o resto por país. Jogos de cada liga pelo relógio. */
export function groupLive(games) {
  const by = new Map();
  for (const g of games || []) {
    if (!by.has(g.league.id)) by.set(g.league.id, { league: g.league, games: [] });
    by.get(g.league.id).games.push(g);
  }
  const rank = (id) => { const i = FIRST.indexOf(id); return i < 0 ? 99 : i; };
  return [...by.values()].sort((a, b) => rank(a.league.id) - rank(b.league.id) || String(a.league.country).localeCompare(String(b.league.country), "pt-BR") || a.league.name.localeCompare(b.league.name, "pt-BR"));
}

function Row({ g, goal, onOpen }) {
  return (
    <div role="button" onClick={onOpen} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: `1px solid ${BORDER}`, background: goal ? "#ecfdf5" : "#fff", transition: "background .6s" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {[g.home, g.away].map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TeamBadge name={t.name} url={t.logo} size={24} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        {goal && <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 11, color: GREEN_DARK }}>GOL!</span>}
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: LIVE_RED, margin: 0 }}>{g.clock}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, width: 22, flexShrink: 0 }}>
        {[g.goals.home, g.goals.away].map((n, i) => <p key={i} style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: goal ? GREEN_DARK : TEXT, margin: 0, lineHeight: "24px" }}>{n == null ? 0 : n}</p>)}
      </div>
    </div>
  );
}

/** Aba "Ao vivo" do Início: jogos acontecendo agora, atualizados a cada 30 s enquanto a aba está aberta; o gol dá destaque verde por alguns segundos. */
export function AoVivo() {
  const [state, setState] = useState({ status: "loading", games: [] });
  const [flash, setFlash] = useState({}); // id -> true (gol recente)
  const prev = useRef(new Map());
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true, timer = null;
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) { timer = setTimeout(tick, REFRESH_MS); return; }
      try {
        const res = await authFetch("/api/live");
        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) throw new Error("live");
        const games = body.games || [];
        const scored = {};
        for (const g of games) {
          const before = prev.current.get(g.id);
          const total = (g.goals.home || 0) + (g.goals.away || 0);
          if (before != null && total > before) scored[g.id] = true;
          prev.current.set(g.id, total);
        }
        if (Object.keys(scored).length) {
          setFlash((f) => ({ ...f, ...scored }));
          setTimeout(() => alive && setFlash((f) => { const n = { ...f }; Object.keys(scored).forEach((k) => delete n[k]); return n; }), 10_000);
        }
        setState({ status: "ready", games });
      } catch {
        if (alive) setState((s) => ({ ...s, status: s.games.length ? "ready" : "error" }));
      }
      if (alive) timer = setTimeout(tick, REFRESH_MS);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  const groups = useMemo(() => groupLive(state.games), [state.games]);
  if (state.status === "loading") return <EmptyState title="Buscando jogos ao vivo..." />;
  if (state.status === "error") return <EmptyState title="Não foi possível carregar agora" body="Tente de novo em instantes." />;
  if (groups.length === 0) return <EmptyState title="Nenhum jogo ao vivo agora" body="Quando uma partida começar nas ligas que acompanhamos, ela aparece aqui." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {open && <PartidaAoVivo game={open} onClose={() => setOpen(null)} />}
      {groups.map(({ league, games }) => (
        <div key={league.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f8fafc" }}>
            {league.logo && <img src={league.logo} alt="" width={28} height={28} style={{ objectFit: "contain" }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: TEXT, margin: 0 }}>{league.name}</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 11, color: MUTED, margin: 0, textTransform: "uppercase" }}>{league.country}</p>
            </div>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: GREEN }} />
          </div>
          {games.map((g) => <Row key={g.id} g={g} goal={!!flash[g.id]} onOpen={() => setOpen(g)} />)}
        </div>
      ))}
    </div>
  );
}
