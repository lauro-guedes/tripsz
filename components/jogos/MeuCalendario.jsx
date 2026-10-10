"use client";
import { WEEKDAY_HEADERS, buildMonthGrid, kickoffParts, monthName, monthTitle, shiftMonth, todayInSaoPaulo } from "../../lib/calendarUtils";
import { supabaseBrowser } from "../../lib/supabase";
import { teamLabel } from "../../lib/textUtils";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, MUTED, TEXT } from "../../lib/tokens";
import TeamBadge from "../TeamBadge";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { Icon } from "../ui/Icon";
import { Loading } from "../ui/Loading";
import { useIsMobile } from "../ui/useIsMobile";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function MeuCalendario({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [user, setUser] = useState({ id: null, name: "", avatar: null });
  const [games, setGames] = useState(null); // null = carregando
  const [view, setView] = useState(() => {
    const [y, m] = todayInSaoPaulo().split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) {
        onLogout();
        return;
      }
      setUser({ id: u.id, name: u.user_metadata?.name || u.email || "", avatar: u.user_metadata?.avatar_url || null });
      const { data: rows, error: loadError } = await supabase
        .from("saved_games")
        .select("*")
        .eq("user_id", u.id)
        .order("kickoff", { ascending: true });
      if (loadError) {
        setError("Não foi possível carregar seu calendário agora.");
        setGames([]);
        return;
      }
      const list = (rows || []).map((g) => ({ ...g, parts: kickoffParts(g.kickoff) }));
      setGames(list);
      // Se o mês atual está vazio mas existe um jogo futuro, já abre no mês dele.
      const today = todayInSaoPaulo();
      const [ty, tm] = today.split("-").map(Number);
      const hasThisMonth = list.some((g) => g.parts.year === ty && g.parts.month === tm - 1);
      const nextGame = list.find((g) => g.parts.dateKey >= today);
      if (!hasThisMonth && nextGame) setView({ year: nextGame.parts.year, month: nextGame.parts.month });
    })();
  }, []);

  const handleRemove = async (g) => {
    if (removingId) return;
    setRemovingId(g.id);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { error: deleteError } = await supabase.from("saved_games").delete().eq("id", g.id);
      if (deleteError) throw deleteError;
      setGames((prev) => prev.filter((x) => x.id !== g.id));
    } catch {
      setError("Não foi possível remover o jogo agora. Tente de novo.");
    } finally {
      setRemovingId(null);
    }
  };

  const loaded = games !== null;
  const daysWithGames = useMemo(() => new Set((games || []).map((g) => g.parts.dateKey)), [games]);
  const monthGames = useMemo(
    () => (games || []).filter((g) => g.parts.year === view.year && g.parts.month === view.month),
    [games, view]
  );
  const stadiumsCount = new Set(monthGames.map((g) => g.venue_name).filter(Boolean)).size;
  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view]);
  const nowMs = Date.now();
  const goMonth = (delta) => setView((v) => shiftMonth(v.year, v.month, delta));

  return (
    <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
      <AuthedNav active="calendario" userName={user.name} userAvatar={user.avatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ background: "linear-gradient(180deg, #e6f5ec 0%, #f8fafc 100%)", padding: isMobile ? `32px ${px}` : `56px ${px}`, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          <div style={{ background: "#eafbf1", padding: "6px 12px", borderRadius: 4, width: "fit-content" }}>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: "#008a3a", margin: 0 }}>SUA PRÓXIMA ARQUIBANCADA</p>
          </div>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 36 : 56, lineHeight: 1.05, color: TEXT, margin: 0 }}>Meu calendário</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 16 : 18, lineHeight: 1.5, color: BODY, margin: 0 }}>Os jogos que você quer viver, organizados em um só lugar.</p>
        </div>
        <div onClick={() => onNavigate("buscar")} style={{ background: GREEN, borderRadius: 8, padding: "13px 20px", display: "flex", gap: 8, alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
          <Icon name="search" size={18} color="#fff" />
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0, whiteSpace: "nowrap" }}>Buscar jogos</p>
        </div>
      </div>

      <div style={{ background: BG_ALT, padding: isMobile ? `24px ${px}` : `40px ${px}`, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 20 : 24, color: TEXT, margin: 0 }}>Sua agenda de {monthName(view.month)}</p>
          <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0 }}>
            {monthGames.length} {monthGames.length === 1 ? "jogo salvo" : "jogos salvos"} • {stadiumsCount} {stadiumsCount === 1 ? "estádio" : "estádios"}
          </p>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#991b1b", margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, alignItems: "flex-start" }}>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 16 : 24, display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24, width: isMobile ? "100%" : "auto", flex: isMobile ? "none" : "1.3 1 0", minWidth: 0, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{monthTitle(view.year, view.month)}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <div onClick={() => goMonth(-1)} style={{ background: BG_ALT, width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <ChevronLeft size={20} color={TEXT} />
                </div>
                <div onClick={() => goMonth(1)} style={{ background: BG_ALT, width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <ChevronRight size={20} color={TEXT} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex" }}>
              {WEEKDAY_HEADERS.map((d) => (
                <p key={d} style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 11, color: MUTED, textAlign: "center", margin: 0 }}>{d}</p>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {grid.map((week, wi) => (
                <div key={wi} style={{ display: "flex", gap: 6 }}>
                  {week.map((cell) => {
                    const marked = daysWithGames.has(cell.dateKey);
                    return (
                      <div key={cell.dateKey} style={{ flex: 1, minWidth: 0, height: isMobile ? 48 : 76, borderRadius: 8, background: marked ? "#eafbf1" : cell.inMonth ? BG : "#fff", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center" }}>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: marked ? 700 : 400, fontSize: 15, color: marked ? "#008a3a" : cell.inMonth ? TEXT : "#94a3b8", margin: 0 }}>{cell.day}</p>
                        {marked && <div style={{ width: 6, height: 6, borderRadius: 3, background: GREEN }} />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: GREEN }} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Dia com jogo no seu calendário</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: isMobile ? "none" : "1 1 0", width: isMobile ? "100%" : "auto", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 4 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Próximos jogos que quero ir</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{monthTitle(view.year, view.month)}</p>
            </div>

            {!loaded && <Loading text="Carregando seu calendário..." compact />}

            {loaded && monthGames.length === 0 && (
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Você ainda não salvou nenhum jogo em {monthName(view.month)}.</p>
                <p onClick={() => onNavigate("buscar")} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0, cursor: "pointer" }}>Buscar jogos →</p>
              </div>
            )}

            {monthGames.map((g) => {
              const past = new Date(g.kickoff).getTime() < nowMs;
              const recent = nowMs - new Date(g.created_at).getTime() < 24 * 3600 * 1000;
              const league = g.league_country && g.league_country !== "World" ? `${g.league_name} • ${g.league_country}` : g.league_name;
              return (
                <div key={g.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 10, opacity: past ? 0.7 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: "#008a3a", textTransform: "uppercase", margin: 0 }}>
                      {g.parts.weekdayAbbr}, {String(g.parts.day).padStart(2, "0")} {g.parts.monthAbbr} • {g.parts.time}
                    </p>
                    {past ? (
                      <div style={{ background: BG_ALT, padding: "4px 8px", borderRadius: 4 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, color: MUTED, margin: 0 }}>JÁ PASSOU</p>
                      </div>
                    ) : recent ? (
                      <div style={{ background: "#eafbf1", padding: "4px 8px", borderRadius: 4 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, color: "#008a3a", margin: 0 }}>RECÉM-ADICIONADO</p>
                      </div>
                    ) : null}
                  </div>
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>{league}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <TeamBadge name={g.home_team} url={g.home_logo} size={26} resolve />
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{teamLabel(g.home_team)} × {teamLabel(g.away_team)}</p>
                    <TeamBadge name={g.away_team} url={g.away_logo} size={26} resolve />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {g.venue_name && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>{g.venue_name}</p>}
                    {g.venue_city && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>{g.venue_city}</p>}
                  </div>
                  <p onClick={() => handleRemove(g)} style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", textDecoration: "underline", margin: 0, cursor: removingId ? "default" : "pointer", width: "fit-content" }}>
                    {removingId === g.id ? "Removendo..." : "Remover do calendário"}
                  </p>
                </div>
              );
            })}

            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.5, color: MUTED, margin: 0 }}>Horários de Brasília. Salvar um jogo não reserva ingressos.</p>
          </div>
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}
