"use client";
import { ArrowDown, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../../lib/authFetch";
import { formatShortDate, formatTimeBrasilia, statusLabel } from "../../../lib/gameDetailsCore";
import { dateOnly } from "../../../lib/dateOnly";
import { teamLabel } from "../../../lib/textUtils";
import { BG_ALT, BODY, BORDER, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_DARK, GREEN_SOFT, MUTED, TEXT } from "../../../lib/tokens";
import TeamBadge from "../../TeamBadge";
import { Icon } from "../../ui/Icon";
import { useIsMobile } from "../../ui/useIsMobile";
import { AbaEscalacao } from "./AbaEscalacao";
import { AbaEstadio } from "./AbaEstadio";
import { AbaEstatisticas } from "./AbaEstatisticas";
import { AbaGols } from "./AbaGols";
import { AbaXP } from "./AbaXP";
import { EmptyNote, TabLoading } from "./ui";

const TABS = [
  { id: "xp", label: "XP" },
  { id: "estadio", label: "Estádio" },
  { id: "escalacao", label: "Escalação" },
  { id: "gols", label: "Gols" },
  { id: "estatisticas", label: "Estatísticas" },
];

// Reabrir o mesmo jogo é instantâneo: guarda a resposta enquanto a página estiver aberta.
const memory = new Map();
export function _clearModalMemory() {
  memory.clear();
}

const ORIGIN = { api: "Via Tripsz", csv: "Importado ✓", manual: "Manual ✓" };

/**
 * Modal "Detalhes da experiência" (Meus Jogos): escalação, gols, estádio,
 * estatísticas e XP de um jogo registrado. No celular abre como folha de baixo
 * pra cima; no desktop, centralizado.
 *
 * game   = linha de attended_games
 * xp     = { total, parts } deste jogo (lib/xpRules)
 * totalXp= XP de todos os jogos da pessoa (pra barra da próxima categoria)
 * visits = { count, first } da pessoa neste estádio
 */
export function DetalhesExperienciaModal({ game, xp, totalXp, visits, isFirstVisit, onClose }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("xp");
  const [state, setState] = useState("loading"); // loading | ready | error
  const [data, setData] = useState(null);
  const [canScroll, setCanScroll] = useState(false);
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    const hit = memory.get(game.id);
    if (hit) {
      setData(hit);
      setState("ready");
      return;
    }
    setState("loading");
    try {
      const res = await authFetch(`/api/games/details?gameId=${encodeURIComponent(game.id)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "erro");
      if (body.available || body.reason === "manual") memory.set(game.id, body); // "indisponível" não guarda: tentar de novo funciona
      setData(body);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [game.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Fecha com Esc (sempre a versão mais recente do onClose).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Trava a página de trás de verdade (no iPhone, overflow:hidden sozinho não
  // basta): congela o body na posição atual e devolve a rolagem ao fechar.
  useEffect(() => {
    const y = window.scrollY;
    const b = document.body.style;
    const prev = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow };
    b.position = "fixed";
    b.top = `-${y}px`;
    b.left = "0";
    b.right = "0";
    b.width = "100%";
    b.overflow = "hidden";
    return () => {
      Object.assign(b, prev);
      window.scrollTo(0, y);
    };
  }, []);

  // Celular: arrastar a alça (ou o cabeçalho) pra baixo minimiza; tocar na alça também.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const onDragStart = (e) => {
    if (!isMobile) return;
    dragRef.current = { startY: e.touches[0].clientY, startT: Date.now(), moved: false };
    setDragging(true);
  };
  const onDragMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.touches[0].clientY - d.startY;
    if (Math.abs(dy) > 6) d.moved = true;
    setDragY(Math.max(0, dy));
  };
  const onDragEnd = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d) return;
    const fast = d.moved && Date.now() - d.startT < 300 && dragY > 40;
    if (dragY > 110 || fast) closeRef.current();
    else setDragY(0);
  };

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (el) setCanScroll(el.scrollHeight - el.clientHeight - el.scrollTop > 8);
  }, []);
  useEffect(() => {
    measure();
  }, [tab, state, data, isMobile, measure]);

  const details = data && data.available ? data.details : null;
  const venue = details ? details.venue : data ? data.venue : null;
  const hasScore = game.home_score != null && game.away_score != null;
  const score = details && details.goals.home != null ? details.goals : hasScore ? { home: game.home_score, away: game.away_score } : null;
  const homeLogo = (details && details.teams.home.logo) || game.home_logo;
  const awayLogo = (details && details.teams.away.logo) || game.away_logo;
  const competition = [game.competition || (details && details.league.name), details && details.league.roundLabel].filter(Boolean).join(" · ");
  const when = [formatShortDate(game.match_date) || dateOnly(game.match_date).toLocaleDateString("pt-BR"), details && formatTimeBrasilia(details.kickoff) ? `${formatTimeBrasilia(details.kickoff)} BRT` : null].filter(Boolean).join(" · ");
  const place = [game.city, game.country].filter(Boolean).join(", ");
  const status = details ? statusLabel(details.status.short) : score ? "ENCERRADO" : null;
  const penalty = details && details.penalty ? `(${details.penalty.home}–${details.penalty.away} pên.)` : null;

  const noData = (label) => {
    if (state === "error") return <EmptyNote title="Não foi possível carregar os dados" text="Verifique sua conexão e tente de novo." onRetry={load} />;
    if (data && data.reason === "manual") return <EmptyNote title="Sem dados da partida" text={`Este jogo foi registrado manualmente, então não temos ${label} dele.`} />;
    if (data && !data.available) return <EmptyNote title="Dados da partida indisponíveis" text={`Não conseguimos buscar ${label} agora. Tente de novo em instantes.`} onRetry={() => { memory.delete(game.id); load(); }} />;
    return null;
  };

  let content;
  if (tab === "xp") content = <AbaXP game={game} xp={xp} totalXp={totalXp} isMobile={isMobile} />;
  else if (tab === "estadio") content = state === "loading" ? <TabLoading /> : <AbaEstadio game={game} venue={venue} visits={visits} isFirstVisit={isFirstVisit} isMobile={isMobile} />;
  else if (state === "loading") content = <TabLoading />;
  else if (!details) content = noData(tab === "escalacao" ? "a escalação" : tab === "gols" ? "os gols e acontecimentos" : "as estatísticas");
  else if (tab === "escalacao") content = <AbaEscalacao details={details} isMobile={isMobile} />;
  else if (tab === "gols") content = <AbaGols details={details} isMobile={isMobile} />;
  else content = <AbaEstatisticas details={details} isMobile={isMobile} />;

  const pad = isMobile ? 24 : 28;
  const note = game.api_fixture_id ? "Dados da partida: API-Football" : "Jogo registrado manualmente";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.4)", overscrollBehavior: "contain", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 24 }}>
      <style>{"@keyframes tripszShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}"}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhes-titulo"
        style={{ background: "#fff", width: "100%", maxWidth: isMobile ? "100%" : 880, maxHeight: isMobile ? "calc(100vh - 56px)" : "calc(100vh - 96px)", borderRadius: isMobile ? "20px 20px 0 0" : 20, boxShadow: "0 20px 64px rgba(15,23,42,0.15)", display: "flex", flexDirection: "column", overflow: "hidden", transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragging ? "none" : "transform 0.2s ease" }}
      >
        {isMobile && (
          <div onClick={onClose} onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd} role="button" aria-label="Minimizar" style={{ display: "flex", justifyContent: "center", padding: "12px 0 6px", flexShrink: 0, cursor: "pointer", touchAction: "none" }}>
            <div style={{ background: BORDER, width: 44, height: 5, borderRadius: 999 }} />
          </div>
        )}

        {/* cabeçalho fixo */}
        <div onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd} style={{ padding: isMobile ? 20 : pad, display: "flex", flexDirection: "column", gap: isMobile ? 16 : 20, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <p id="detalhes-titulo" style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 15 : 18, lineHeight: 1.3, color: TEXT, margin: 0, flex: 1, minWidth: 0 }}>Detalhes da experiência</p>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ background: GREEN_SOFT, border: `1px solid ${BORDER}`, borderRadius: 6, padding: isMobile ? "5px 7px" : "5px 8px" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 10, lineHeight: 1.4, color: GREEN_DARK, margin: 0, whiteSpace: "nowrap" }}>{ORIGIN[game.source] || ORIGIN.manual}</p>
              </div>
              {xp && (
                <div title="XP que este jogo gerou" style={{ background: GREEN, borderRadius: 6, padding: isMobile ? "6px 8px" : "6px 10px" }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: isMobile ? 11 : 12, lineHeight: 1.4, color: "#fff", margin: 0, whiteSpace: "nowrap" }}>+{xp.total} XP</p>
                </div>
              )}
              <div onClick={onClose} role="button" aria-label="Fechar" style={{ background: BG_ALT, width: 32, height: 32, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={18} color={TEXT} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: isMobile ? 18 : 36, alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: isMobile ? 100 : 160, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <TeamBadge name={game.home_team} url={homeLogo} size={48} />
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 14 : 16, lineHeight: 1.4, color: TEXT, margin: 0, textAlign: "center" }}>{teamLabel(game.home_team)}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <p data-testid="placar" style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 36 : 48, lineHeight: 1.2, color: TEXT, margin: 0, whiteSpace: "nowrap" }}>{score ? `${score.home} × ${score.away}` : "×"}</p>
              {status && <p style={{ fontFamily: FONT_MONO, fontSize: 10, lineHeight: 1.4, color: MUTED, margin: 0 }}>{status}{penalty ? ` ${penalty}` : ""}</p>}
            </div>
            <div style={{ width: isMobile ? 100 : 160, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <TeamBadge name={game.away_team} url={awayLogo} size={48} />
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 14 : 16, lineHeight: 1.4, color: TEXT, margin: 0, textAlign: "center" }}>{teamLabel(game.away_team)}</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 5 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontFamily: FONT_MONO, fontSize: 12, lineHeight: 1.4, color: BODY, margin: 0 }}>{when}</p>
              {competition && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.4, color: MUTED, margin: 0 }}>{competition}</p>}
            </div>
            {place && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Icon name="mapPin" size={16} color={MUTED} />
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.4, color: MUTED, margin: 0 }}>{place}</p>
              </div>
            )}
          </div>
        </div>

        {/* abas */}
        <div style={{ position: "relative", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <div role="tablist" style={{ display: "flex", overflow: "hidden" }}>
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <div
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  style={{ flex: "1 1 0", minWidth: 0, height: isMobile ? 48 : 52, padding: "0 2px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxSizing: "border-box", borderBottom: on ? `3px solid ${GREEN}` : "3px solid transparent", marginBottom: -1 }}
                >
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: on ? 700 : 400, fontSize: isMobile ? 12 : 13, lineHeight: 1.4, color: on ? GREEN_DARK : MUTED, margin: 0, whiteSpace: "nowrap" }}>{t.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* conteúdo rolável */}
        <div ref={scrollRef} onScroll={measure} role="tabpanel" style={{ flex: 1, minHeight: isMobile ? 360 : 420, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: pad, scrollbarWidth: "thin" }}>
          {content}
        </div>

        {/* rodapé */}
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: `12px ${pad}px`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, lineHeight: 1.4, color: MUTED, margin: 0 }}>{note}</p>
          {canScroll && <ArrowDown size={14} color={MUTED} aria-label="Role para ver mais" />}
        </div>
      </div>
    </div>
  );
}
