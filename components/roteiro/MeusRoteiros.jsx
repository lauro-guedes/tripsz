"use client";
import { supabaseBrowser } from "../../lib/supabase";
import { teamLabel } from "../../lib/textUtils";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, GOLD_BG, GREEN, GREEN_BG, MUTED, TEXT } from "../../lib/tokens";
import { planToTrip } from "../../lib/tripPlanClient";
import TeamBadge from "../TeamBadge";
import { PHOTO_STADIUM } from "../landing/LandingPage";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Loading } from "../ui/Loading";
import { useIsMobile } from "../ui/useIsMobile";
import { useEffect, useState } from "react";

/* --- Meus Roteiros: lista de verdade, lida do Supabase --- */
export function MeusRoteiros({ onNavigate, onLogout, onOpenTrip, onEditTrip, onCreateNew }) {
  const isMobile = useIsMobile();
  const [trips, setTrips] = useState(null); // null = carregando
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState(null);

  const loadTrips = async () => {
    const supabase = supabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    setUserName(userData.user?.user_metadata?.name || userData.user?.email || "");
    setUserAvatar(userData.user?.user_metadata?.avatar_url || null);

    // RLS já garante que só voltam as viagens do próprio usuário — não
    // precisa (nem pode) filtrar por user_id manualmente aqui.
    const { data, error: fetchError } = await supabase
      .from("trip_answers")
      .select("*, orders(status, paid_at)")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setTrips([]);
      return;
    }
    setTrips(data || []);
  };

  useEffect(() => {
    loadTrips();
  }, []);

  // O roteiro em si nunca fica bloqueado por pagamento — o status aqui
  // reflete só o andamento da viagem. Pedidos em `orders` agora são só
  // consultorias humanas opcionais, então viram um indicador à parte
  // (hasConsultoria), não um portão de acesso.
  const deriveStatus = (row) => {
    if (row.date_end && new Date(row.date_end) < new Date()) return "Concluído";
    if (row.date_start) return "Ativo";
    return "Rascunho";
  };
  const hasConsultoria = (row) => row.orders?.some((o) => o.status === "paid" && o.item_type === "consultoria");

  const rowToAnswers = (row) => ({
    tripAnswersId: row.id,
    countries: row.countries || [],
    dateStart: row.date_start,
    dateEnd: row.date_end,
    flexLevel: row.flex_level,
    adults: row.adults,
    kids: row.kids,
    budget: row.budget,
    priority: row.priority,
    pace: row.pace,
    favoriteTeams: row.favorite_teams || [],
  });

  const handleDelete = async (row) => {
    if (!window.confirm(`Excluir o roteiro de ${row.countries?.join(" & ") || "viagem"}? Essa ação não pode ser desfeita.`)) return;
    const supabase = supabaseBrowser();
    const { error: delError } = await supabase.from("trip_answers").delete().eq("id", row.id);
    if (delError) {
      alert("Não foi possível excluir: " + delError.message);
      return;
    }
    setTrips((t) => t.filter((r) => r.id !== row.id));
  };

  const filtered = (trips || []).filter((row) => {
    const status = deriveStatus(row);
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (search) {
      const haystack = (row.countries || []).join(" ").toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const px = isMobile ? "16px" : "80px";

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="roteiros" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24, padding: isMobile ? `32px ${px}` : `80px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <Badge>Planejamento Ativo</Badge>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 56, lineHeight: 1.05, color: TEXT, margin: 0, position: "relative" }}>Biblioteca de Roteiros</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 22, lineHeight: 1.5, color: BODY, margin: 0, position: "relative", maxWidth: 700 }}>Acompanhe, duplique ou crie variações de trajetos para assistir aos melhores espetáculos de arquibancada do mundo.</p>
        <div style={{ position: "relative" }}>
          <Button onClick={onCreateNew}>Criar Novo Roteiro</Button>
        </div>
      </div>

      <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: isMobile ? `20px ${px}` : `40px ${px}` }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, width: "100%" }}>
          <div style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 8 }}>
            <Icon name="search" size={18} color={MUTED} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar roteiro por destino..."
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14, color: TEXT }}
          >
            <option value="all">Status: Todos</option>
            <option value="Ativo">Ativo</option>
            <option value="Concluído">Concluído</option>
            <option value="Rascunho">Rascunho</option>
          </select>
        </div>
      </div>

      <div style={{ background: BG_ALT, padding: isMobile ? `24px ${px}` : `48px ${px}`, display: "flex", flexDirection: "column", gap: 24 }}>
        {trips === null && <Loading text="Carregando seus roteiros..." />}
        {error && <p style={{ fontFamily: FONT_DISPLAY, color: "#dc2626" }}>Erro ao carregar: {error}</p>}
        {trips !== null && filtered.length === 0 && (
          <div style={{ background: "#fff", border: `1px dashed ${BORDER}`, borderRadius: 12, padding: 48, textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Nenhum roteiro por aqui ainda</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: BODY, margin: "8px 0 20px" }}>Preencha o questionário pra gerar seu primeiro roteiro de futebol.</p>
            <Button onClick={onCreateNew}>Criar Novo Roteiro</Button>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>
          {filtered.map((row) => {
            const status = deriveStatus(row);
            const preview = planToTrip(row.plan, row.countries);
            const days = row.date_start && row.date_end ? Math.max(1, Math.round((new Date(row.date_end) - new Date(row.date_start)) / 86400000)) : preview.days;
            const statusColor = status === "Ativo" ? GREEN : MUTED;
            return (
              <div key={row.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, margin: 0 }}>{(row.countries || []).join(" & ").toUpperCase() || "SEM PAÍS"} // {days} DIAS</p>
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>{new Date(row.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).toUpperCase()}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>{(row.countries || []).join(" & ") || "Roteiro sem destino"}</p>
                    <div style={{ background: statusColor === GREEN ? GREEN_BG : BG_ALT, padding: "4px 8px", borderRadius: 4 }}>
                      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: statusColor, margin: 0 }}>{status.toUpperCase()}</p>
                    </div>
                    {hasConsultoria(row) && (
                      <div style={{ background: GOLD_BG, padding: "4px 8px", borderRadius: 4 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: GOLD, margin: 0 }}>CONSULTORIA CONTRATADA</p>
                      </div>
                    )}
                  </div>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: BODY, margin: 0 }}>{row.plan ? `${preview.games.length} partida(s) no roteiro, sequência por ${preview.cities.join(", ") || "definir"}.` : "Abra o roteiro para ver as partidas."}</p>
                </div>
                {preview.games.length > 0 && (
                  <div style={{ background: BG_ALT, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: MUTED, margin: 0 }}>PARTIDAS SUGERIDAS</p>
                    {preview.games.slice(0, 2).map((g, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <TeamBadge name={g.home} url={g.homeLogo} size={18} />
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{teamLabel(g.home)} × {teamLabel(g.away)}</p>
                          <TeamBadge name={g.away} url={g.awayLogo} size={18} />
                        </div>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{g.stadium}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 16 }}>
                    <p onClick={() => onOpenTrip(rowToAnswers(row), row.plan, row.selected_option)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0, cursor: "pointer" }}>Abrir Roteiro</p>
                    <p onClick={() => onEditTrip(rowToAnswers(row))} style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14, color: MUTED, margin: 0, cursor: "pointer" }}>Editar</p>
                    <p onClick={() => handleDelete(row)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14, color: "#ef4444", margin: 0, cursor: "pointer" }}>Excluir</p>
                  </div>
                </div>
              </div>
            );
          })}
          {trips !== null && (
            <div onClick={onCreateNew} style={{ background: "#fff", border: `2px dashed ${BORDER}`, borderRadius: 12, display: "flex", flexDirection: "column", gap: 16, alignItems: "center", justifyContent: "center", padding: 32, cursor: "pointer", minHeight: 220 }}>
              <div style={{ background: GREEN_BG, width: 48, height: 48, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="arrowRight" size={20} color={GREEN} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Criar uma nova alternativa</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: "4px 0 0" }}>Gere um novo Football Passport com destinos diferentes.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}
