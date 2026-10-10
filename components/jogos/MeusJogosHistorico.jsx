"use client";
import { countryKey } from "../../lib/countries";
import { dateOnly } from "../../lib/dateOnly";
import { seasonOfGame } from "../../lib/gameSeason";
import { checkPassportAccess } from "../../lib/passportAccess";
import { compareSeasonsDesc } from "../../lib/seasons";
import { supabaseBrowser } from "../../lib/supabase";
import { teamLabel } from "../../lib/textUtils";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BG, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import { xpBreakdown } from "../../lib/xpRules";
import TeamBadge from "../TeamBadge";
import { PassportPaywall } from "../conta/PassportPaywall";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { Icon } from "../ui/Icon";
import { Loading } from "../ui/Loading";
import { useIsMobile } from "../ui/useIsMobile";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

export function MeusJogosHistorico({ onNavigate, onLogout, onRegisterNew }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [games, setGames] = useState(null);
  const [tab, setTab] = useState("todos");
  const [search, setSearch] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("todas");
  const [access, setAccess] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ stadium: "", city: "", country: "", competition: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const loadGames = async () => {
    const acc = await checkPassportAccess();
    setAccess(acc);
    if (!acc.hasAccess) return;

    const supabase = supabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setUserName(user?.user_metadata?.name || user?.email || "");
    setUserAvatar(user?.user_metadata?.avatar_url || null);

    const { data } = await supabase.from("attended_games").select("*").order("match_date", { ascending: false });
    setGames(data || []);
  };

  useEffect(() => {
    loadGames();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Remover este jogo do seu histórico?")) return;
    const supabase = supabaseBrowser();
    await supabase.from("attended_games").delete().eq("id", id);
    loadGames();
  };

  const startEdit = (g) => {
    setEditError(null);
    setEditForm({ stadium: g.stadium || "", city: g.city || "", country: g.country || "", competition: g.competition || "" });
    setEditingId(g.id);
  };

  const saveEdit = async (g) => {
    if (!editForm.country.trim()) {
      setEditError("Informe o país.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    const patch = {
      stadium: editForm.stadium.trim() || null,
      city: editForm.city.trim() || null,
      country: editForm.country.trim(),
      competition: editForm.competition.trim() || null,
    };
    const supabase = supabaseBrowser();
    const { data, error: updError } = await supabase.from("attended_games").update(patch).eq("id", g.id).select("id");
    setEditSaving(false);
    if (updError || !data || data.length === 0) {
      setEditError("Não foi possível salvar a alteração agora.");
      return;
    }
    setGames((list) => (list || []).map((x) => (x.id === g.id ? { ...x, ...patch } : x)));
    setEditingId(null);
  };

  const all = games || [];
  // XP que cada jogo gerou (lib/xpRules.js) — calculado sobre TODOS os jogos, sem depender dos filtros da tela.
  const xpInfo = xpBreakdown(all);
  const stadiums = new Set(all.map((g) => g.stadium).filter(Boolean));
  const countries = new Set(all.map((g) => countryKey(g.country)).filter(Boolean));
  const seasonByKey = new Map();
  all.forEach((g) => {
    const se = seasonOfGame(g);
    seasonByKey.set(se.key, se);
  });
  const seasons = Array.from(seasonByKey.values()).sort(compareSeasonsDesc); // [{ key, label, year, kind }]

  const filtered = all.filter((g) => {
    if (tab === "tripsz" && g.source !== "api") return false;
    if (tab === "manuais" && g.source !== "manual") return false;
    if (seasonFilter !== "todas" && seasonOfGame(g).key !== seasonFilter) return false;
    if (search && !(g.stadium || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = {};
  filtered.forEach((g) => {
    const k = seasonOfGame(g).key;
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(g);
  });
  const orderedSeasons = Object.keys(grouped).sort((a, b) => compareSeasonsDesc(seasonByKey.get(a), seasonByKey.get(b)));

  if (access === null) {
    return (
      <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
        <AuthedNav active="jogos" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <Loading />
      </div>
    );
  }
  if (!access.hasAccess) {
    return (
      <div style={{ background: BG, width: "100%" }}>
        <AuthedNav active="jogos" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <PassportPaywall userId={access.userId} userEmail={access.userEmail} userName={userName} userAvatar={userAvatar} />
        <AuthedFooter />
      </div>
    );
  }

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="jogos" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: isMobile ? `24px ${px} 8px` : `48px ${px} 8px` }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 40, lineHeight: 1.1, color: TEXT, margin: 0 }}>Meus Jogos</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, lineHeight: 1.5, color: BODY, margin: 0 }}>
          {all.length} {all.length === 1 ? "jogo" : "jogos"} · {stadiums.size} {stadiums.size === 1 ? "estádio" : "estádios"} · {countries.size} {countries.size === 1 ? "país" : "países"}
        </p>
      </div>

      <div style={{ background: BG_ALT, padding: isMobile ? `24px ${px}` : `80px ${px}`, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[["todos", "Todos"], ["tripsz", "Via Tripsz"], ["manuais", "Manuais"]].map(([id, label]) => (
              <div key={id} onClick={() => setTab(id)} style={{ background: tab === id ? GREEN_BG : "#fff", border: `1px solid ${tab === id ? GREEN : BORDER}`, padding: "8px 16px", borderRadius: 999, cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: tab === id ? 700 : 500, fontSize: 14, color: tab === id ? GREEN : BODY, margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
          <div onClick={onRegisterNew} style={{ background: GREEN_BUTTON, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "12px 20px", borderRadius: 8, cursor: "pointer" }}>
            <Icon name="pen" size={16} color={TEXT} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, textTransform: "uppercase", margin: 0 }}>Registrar Novo Jogo</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16 }}>
          <div style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 8 }}>
            <Icon name="search" size={18} color={MUTED} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por estádio..." style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT }} />
          </div>
          <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14, color: TEXT, width: isMobile ? "100%" : 240 }}>
            <option value="todas">Todas as temporadas</option>
            {seasons.map((se) => <option key={se.key} value={se.key}>Temporada {se.label}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, color: TEXT, margin: 0 }}>Histórico de Partidas</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Filtrado por: {tab === "todos" ? "Todos" : tab === "tripsz" ? "Via Tripsz" : "Manuais"}</p>
        </div>

        {games === null && <Loading />}
        {games !== null && filtered.length === 0 && (
          <div style={{ background: "#fff", border: `1px dashed ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: BODY, margin: 0 }}>Nenhum jogo encontrado. Registre os jogos que você já assistiu pra eles contarem no seu Football Passport.</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {orderedSeasons.map((season) => (
            <div key={season} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: TEXT, margin: 0 }}>Temporada {seasonByKey.get(season)?.label}</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: MUTED, margin: 0 }}>{grouped[season].length} jogo(s)</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {grouped[season].map((g) => {
                  const expanded = expandedId === g.id;
                  return (
                    <div key={g.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", gap: isMobile ? 8 : 24, alignItems: "center", flexWrap: "wrap" }}>
                          <p style={{ fontFamily: FONT_MONO, fontSize: 13, color: MUTED, margin: 0 }}>{dateOnly(g.match_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <TeamBadge name={g.home_team} url={g.home_logo} size={22} resolve />
                            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: TEXT, margin: 0 }}>{teamLabel(g.home_team)} {g.home_score != null && g.away_score != null ? `${g.home_score}×${g.away_score}` : "×"} {teamLabel(g.away_team)}</p>
                            <TeamBadge name={g.away_team} url={g.away_logo} size={22} resolve />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ background: g.source === "api" ? GREEN_BG : BG_ALT, border: `1px solid ${g.source === "api" ? GREEN : BORDER}`, padding: "4px 10px", borderRadius: 4 }}>
                            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: g.source === "api" ? GREEN : BODY, margin: 0 }}>{g.source === "api" ? "Via Tripsz" : g.source === "csv" ? "Importado ✓" : "Manual ✓"}</p>
                          </div>
                          {xpInfo.byId.get(g.id) && (
                            <div title="XP que este jogo gerou" style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, padding: "4px 10px", borderRadius: 4 }}>
                              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, margin: 0 }}>+{xpInfo.byId.get(g.id).total} XP</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <MapPin size={16} color={BODY} />
                          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>{g.stadium || g.country}</p>
                        </div>
                        <div onClick={() => setExpandedId(expanded ? null : g.id)} style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>Ver detalhes da experiência</p>
                          <Icon name={expanded ? "chevronDown" : "chevronRight"} size={14} color={GREEN} />
                        </div>
                      </div>
                      {expanded && (
                        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                          {editingId === g.id ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {[["stadium", "Estádio"], ["city", "Cidade"], ["country", "País"], ["competition", "Competição"]].map(([k, label]) => (
                                <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>{label}</p>
                                  <input value={editForm[k]} onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, outline: "none", width: "100%", boxSizing: "border-box" }} />
                                </div>
                              ))}
                              {editError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{editError}</p>}
                              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                                <div onClick={editSaving ? undefined : () => saveEdit(g)} style={{ background: GREEN, opacity: editSaving ? 0.6 : 1, borderRadius: 8, padding: "10px 18px", cursor: editSaving ? "default" : "pointer" }}>
                                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", margin: 0 }}>{editSaving ? "Salvando..." : "Salvar"}</p>
                                </div>
                                <p onClick={() => setEditingId(null)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: MUTED, margin: 0, cursor: "pointer" }}>Cancelar</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {g.competition && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: 0 }}>Competição: {g.competition}</p>}
                                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: 0 }}>{g.city ? `${g.city}, ` : ""}{g.country}</p>
                              </div>
                              {xpInfo.byId.get(g.id) && (
                                <div style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>XP gerado por este jogo: +{xpInfo.byId.get(g.id).total}</p>
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {xpInfo.byId.get(g.id).parts.map((p) => (
                                      <span key={p.key} style={{ background: "#fff", border: `1px solid ${GREEN}`, borderRadius: 999, padding: "3px 10px", fontFamily: FONT_DISPLAY, fontSize: 12, color: BODY }}>{p.label} <b style={{ color: GREEN }}>+{p.xp}</b></span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                                <p onClick={() => startEdit(g)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0, cursor: "pointer" }}>Editar local</p>
                                <p onClick={() => handleDelete(g.id)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#ef4444", margin: 0, cursor: "pointer" }}>Remover este jogo</p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}
