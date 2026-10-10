"use client";
import { teamLabel } from "../../lib/textUtils";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BG, MUTED, TEXT } from "../../lib/tokens";
import TeamBadge from "../TeamBadge";
import { MobileProgress, WIZARD_TOTAL, WizardBottomBar, WizardTopBar } from "../nav/WizardChrome";
import { Icon } from "../ui/Icon";
import { useIsMobile } from "../ui/useIsMobile";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";

// Times por liga/país — usa os mesmos nomes de time que já têm escudo
// mapeado (TEAM_LOGO_IDS), pra garantir que os logos apareçam certinho.
export const TEAMS_BY_LEAGUE = [
  { country: "Inglaterra", league: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", teams: ["Arsenal", "Chelsea", "Liverpool", "Manchester City"] },
  { country: "Espanha", league: "La Liga", flag: "🇪🇸", teams: ["Real Madrid", "Barcelona", "Atlético Madrid", "Sevilla"] },
  { country: "Itália", league: "Serie A", flag: "🇮🇹", teams: ["Inter", "Milan", "Napoli", "Roma", "Lazio"] },
  { country: "Alemanha", league: "Bundesliga", flag: "🇩🇪", teams: ["Bayern München", "Borussia Dortmund"] },
  { country: "França", league: "Ligue 1", flag: "🇫🇷", teams: ["PSG", "Marseille"] },
  { country: "Portugal", league: "Primeira Liga", flag: "🇵🇹", teams: ["Porto", "Benfica"] },
  { country: "Holanda", league: "Eredivisie", flag: "🇳🇱", teams: ["Ajax", "Feyenoord", "PSV"] },
  { country: "Turquia", league: "Süper Lig", flag: "🇹🇷", teams: ["Galatasaray", "Fenerbahçe"] },
  { country: "Argentina", league: "Liga Profesional", flag: "🇦🇷", teams: ["Boca Juniors", "River Plate"] },
  { country: "Brasil", league: "Brasileirão", flag: "🇧🇷", teams: ["Flamengo", "Fluminense", "Corinthians", "Palmeiras"] },
  { country: "Uruguai", league: "Primera División", flag: "🇺🇾", teams: ["Peñarol", "Nacional"] },
  { country: "Chile", league: "Primera División", flag: "🇨🇱", teams: ["Colo-Colo", "Universidad de Chile"] },
  { country: "Colômbia", league: "Primera A", flag: "🇨🇴", teams: ["Millonarios", "Santa Fe"] },
];


export function StepTimesFavoritos({ answers, setAnswers, onNext, onBack, onHome, stepOffset = 0 }) {
  const isMobile = useIsMobile();
  const favoriteTeams = answers.favoriteTeams || [];
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const toggleTeam = (team) =>
    setAnswers((a) => ({
      ...a,
      favoriteTeams: favoriteTeams.includes(team) ? favoriteTeams.filter((t) => t !== team) : [...favoriteTeams, team],
    }));

  // Autocomplete de verdade: busca times reais na API (não só os ~30 já
  // conhecidos), com debounce pra não gastar cota a cada tecla.
  useEffect(() => {
    if (search.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teams/suggest?q=${encodeURIComponent(search)}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const pickSuggestion = (name) => {
    toggleTeam(name);
    setSearch("");
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // A grade de times por liga fica sempre visível (times pré-conhecidos
  // dos países escolhidos no passo anterior) — a busca serve só pra
  // adicionar OUTROS times que não estão nessa lista fixa, sem esconder
  // a grade ou dar a impressão de que as escolhas anteriores sumiram.
  const selectedCountries = answers.countries || [];
  const groups = TEAMS_BY_LEAGUE.filter((g) => selectedCountries.length === 0 || selectedCountries.includes(g.country));

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <WizardTopBar step={3 - stepOffset} total={WIZARD_TOTAL - stepOffset} onExit={onBack} onLogoClick={onHome} />
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 32, alignItems: "center", padding: isMobile ? "24px 16px" : "40px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: "center", textAlign: "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Quais são seus times favoritos?</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 720, margin: 0 }}>Selecione os clubes que você quer acompanhar — montaremos roteiros personalizados para os jogos deles.</p>
        </div>
        {isMobile && <MobileProgress step={3 - stepOffset} total={WIZARD_TOTAL - stepOffset} />}

        <div style={{ position: "relative", width: isMobile ? "100%" : 600 }}>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 8 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Buscar qualquer time (ex: Fiorentina)..."
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT }}
            />
            <Icon name="search" size={18} color={MUTED} />
          </div>
          {showSuggestions && search.trim().length >= 3 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", zIndex: 20, overflow: "hidden" }}>
              {loadingSuggestions && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0, padding: "12px 16px" }}>Buscando...</p>
              )}
              {!loadingSuggestions && suggestions.length === 0 && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0, padding: "12px 16px" }}>Nenhum time encontrado com esse nome.</p>
              )}
              {!loadingSuggestions && suggestions.map((s) => (
                <div key={s.name} onMouseDown={() => pickSuggestion(s.name)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                  <TeamBadge name={s.name} url={s.logo} size={24} />
                  <div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{teamLabel(s.name)}</p>
                    {s.country && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{s.country}</p>}
                  </div>
                  {favoriteTeams.includes(s.name) && <Check size={16} color={GREEN} style={{ marginLeft: "auto" }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {favoriteTeams.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", width: isMobile ? "100%" : 900 }}>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: GREEN, textTransform: "uppercase", margin: 0, width: "100%", textAlign: isMobile ? "left" : "center" }}>Times selecionados ({favoriteTeams.length})</p>
            {favoriteTeams.map((team) => (
              <div key={team} onClick={() => toggleTeam(team)} style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 999, padding: "6px 12px", display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>{teamLabel(team)}</p>
                <X size={12} color={GREEN} />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 40, width: isMobile ? "100%" : 900 }}>
          {groups.map((g) => (
            <div key={g.league} style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>{g.flag}</span>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{g.league}</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>({g.country})</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
                {g.teams.map((team) => {
                  const active = favoriteTeams.includes(team);
                  return (
                    <div key={team} onClick={() => toggleTeam(team)} style={{ background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "16px 20px", borderRadius: 8, cursor: "pointer" }}>
                      <TeamBadge name={team} size={24} />
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: active ? 700 : 500, fontSize: 14, color: active ? GREEN : TEXT, margin: 0, flex: 1 }}>{teamLabel(team)}</p>
                      {active && <Check size={16} color={GREEN} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <WizardBottomBar onBack={onBack} onNext={onNext} />
    </div>
  );
}
