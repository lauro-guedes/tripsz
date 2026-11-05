"use client";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../lib/authFetch";
import { BG_ALT, BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import TeamBadge from "../TeamBadge";
import { AbaEscalacao } from "../jogos/detalhes/AbaEscalacao";
import { AbaEstatisticas } from "../jogos/detalhes/AbaEstatisticas";
import { AbaGols } from "../jogos/detalhes/AbaGols";
import { EmptyNote, TabLoading } from "../jogos/detalhes/ui";

const REFRESH_MS = 30_000;
const LIVE_RED = "#e11d48";
const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);
const TABS = [["resumo", "Resumo"], ["estatisticas", "Estatísticas"], ["escalacao", "Escalações"]];

function clock(st) {
  const s = st && st.short;
  if (s === "HT") return "Intervalo";
  if (s === "BT") return "Intervalo da prorrogação";
  if (s === "P") return "Pênaltis";
  if (s === "NS" || s === "TBD") return "Ainda não começou";
  if (s === "FT" || s === "AET" || s === "PEN") return "Encerrado";
  if (st && st.elapsed != null) return `${st.elapsed}${st.extra ? `+${st.extra}` : ""}'`;
  return "Ao vivo";
}
const kickoffLabel = (iso) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "";
};

/** Tela de um jogo em andamento: placar e relógio, resumo (gols, cartões, trocas), estatísticas e escalações. Atualiza a cada 30 s enquanto aberta. */
export function PartidaAoVivo({ game, onClose }) {
  const [tab, setTab] = useState("resumo");
  const [details, setDetails] = useState(null);
  const [state, setState] = useState("loading");
  const [goalFlash, setGoalFlash] = useState(false);
  const lastTotal = useRef(null);
  const live = !details || LIVE.has(details.status.short) || details.status.short === "NS";

  const load = useCallback(async (quiet) => {
    if (!quiet) setState("loading");
    try {
      const res = await authFetch(`/api/live/${encodeURIComponent(game.id)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.details) throw new Error("detail");
      const d = body.details;
      const total = (d.goals.home || 0) + (d.goals.away || 0);
      if (lastTotal.current != null && total > lastTotal.current) { setGoalFlash(true); setTimeout(() => setGoalFlash(false), 8000); }
      lastTotal.current = total;
      setDetails(d);
      setState("ready");
    } catch {
      setState((s) => (s === "ready" ? "ready" : "error"));
    }
  }, [game.id]);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(() => { if (!document.hidden) load(true); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [live, load]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const home = (details && details.teams.home) || game.home;
  const away = (details && details.teams.away) || game.away;
  const gh = details ? details.goals.home : game.goals.home, ga = details ? details.goals.away : game.goals.away;
  const status = details && details.status;
  const isLiveNow = status ? LIVE.has(status.short) : true;
  const league = [(details && details.league.name) || game.league.name, details && details.league.roundLabel].filter(Boolean).join(" · ");

  let content;
  if (state === "loading") content = <TabLoading />;
  else if (!details) content = <EmptyNote title="Não foi possível carregar o jogo" text="Verifique sua conexão e tente de novo." onRetry={() => load(false)} />;
  else if (tab === "resumo") content = <AbaGols details={details} isMobile />;
  else if (tab === "estatisticas") content = <AbaEstatisticas details={details} isMobile />;
  else content = <AbaEscalacao details={details} isMobile />;

  return (
    <div role="dialog" aria-modal="true" aria-label={`${home.name} x ${away.name}`} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#fff", display: "flex", flexDirection: "column" }}>
      <style>{"@keyframes tripszShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}"}</style>
      <div style={{ background: "linear-gradient(135deg,#0f172a,#14532d)", padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 18px", color: "#fff", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div role="button" aria-label="Voltar" onClick={onClose} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginLeft: -8 }}><ChevronLeft size={26} color="#fff" /></div>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,0.85)", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{league}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
          {[home, away].map((t, i) => (
            <div key={i} style={{ order: i === 0 ? 0 : 2, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div style={{ background: "#fff", borderRadius: 18, padding: 8 }}><TeamBadge name={t.name} url={t.logo} size={52} /></div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, margin: 0, textAlign: "center", lineHeight: 1.2 }}>{t.name}</p>
            </div>
          ))}
          <div style={{ order: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 96 }}>
            {details && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>{kickoffLabel(details.kickoff)}</p>}
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 40, margin: 0, lineHeight: 1, color: goalFlash ? "#4ade80" : "#fff", transition: "color .5s" }}>{gh == null ? 0 : gh} – {ga == null ? 0 : ga}</p>
            {goalFlash && <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 12, color: "#4ade80" }}>GOL!</span>}
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, margin: 0, color: isLiveNow ? "#fb7185" : "rgba(255,255,255,0.85)" }}>{status ? clock(status) : game.clock}</p>
          </div>
        </div>
      </div>
      <div role="tablist" style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(([id, label]) => (
          <div key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ flex: 1, textAlign: "center", padding: "13px 0", cursor: "pointer", borderBottom: `3px solid ${tab === id ? GREEN : "transparent"}` }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: tab === id ? GREEN_DARK : MUTED, margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)", background: "#fff" }}>{content}</div>
    </div>
  );
}
