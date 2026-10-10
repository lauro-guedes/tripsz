/**
 * tripsz — full flow, implemented from Figma nodes:
 * 91:2 (landing), 95:489 (criar conta), 95:419 (destino), 95:546 (datas),
 * 95:606 (pessoas+orçamento), 95:681 (preferências), 95:746 (loading),
 * 95:769 (resultado bloqueado), 95:877 (checkout), 95:982 (desbloqueado).
 *
 * Business model note: this flow prices differently from the earlier
 * dark "Matchday Planner" prototype — here it's a FIXED R$ 49,90 to
 * unlock the crossed fixtures/route, with human consultancy offered
 * as a separate, unpriced-in-app upsell (not bundled).
 *
 * Icons: real path data reused where you'd uploaded the SVG (arrow-right,
 * circle-x, lock-keyhole); everything else in this flow (globe, check,
 * calendar, alert-triangle, shield, info, credit-card, lock, lightbulb)
 * uses lucide-react, since those specific files weren't uploaded.
 */
"use client";
import { useState, useMemo, useEffect } from "react";
import { Check, Calendar, Info, Lock, MapPin, Download, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { supabaseBrowser } from "../lib/supabase";
import { GREEN, GREEN_BUTTON, GREEN_BG, GOLD, GOLD_BG, BG, BG_ALT, BORDER, TEXT, BODY, MUTED, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../lib/tokens";
import { seasonOptionGroups, parseSeasonValue, compareSeasonsDesc } from "../lib/seasons";
import { countryKey } from "../lib/countries";
import { dateOnly } from "../lib/dateOnly";
import { teamLabel } from "../lib/textUtils";
import { buildOptions } from "../lib/tripOptions";
import TeamBadge from "./TeamBadge";
import { authFetch } from "../lib/authFetch";
import { parseFutbologyLine, guessCountryFromCompetition } from "../lib/futbologyParse";
import { xpBreakdown } from "../lib/xpRules";
import { todayInSaoPaulo, kickoffParts, formatLongDate, monthName, monthTitle, shiftMonth, buildMonthGrid, cityWithoutCountry, cityShortName, RADIUS_OPTIONS, WEEKDAY_HEADERS } from "../lib/calendarUtils";
import { AuthedFooter } from "./nav/AuthedFooter";
import { AuthedNav } from "./nav/AuthedNav";
import { FontImports } from "./ui/FontImports";
import { Icon } from "./ui/Icon";
import { Loading } from "./ui/Loading";
import { useIsMobile } from "./ui/useIsMobile";
import { CriarConta } from "./auth/CriarConta";
import { LoginModal } from "./auth/LoginModal";
import { StepAccount } from "./auth/StepAccount";
import { LandingPage } from "./landing/LandingPage";
import { LoadingScreen } from "./wizard/LoadingScreen";
import { StepDatas } from "./wizard/StepDatas";
import { StepDestino } from "./wizard/StepDestino";
import { StepPessoasOrcamento } from "./wizard/StepPessoasOrcamento";
import { StepPreferencias } from "./wizard/StepPreferencias";
import { StepTimesFavoritos } from "./wizard/StepTimesFavoritos";
import { MeusRoteiros } from "./roteiro/MeusRoteiros";
import { ResultadoRoteiro, RoteiroDetalhe } from "./roteiro/RoteiroView";
import { fetchPlan, planToTrip, slimPlan } from "../lib/tripPlanClient";
import { Checkout } from "./checkout/Checkout";
import { AssinarStandalone } from "./conta/AssinarStandalone";
import { MeuNivel } from "./conta/MeuNivel";
import { MeuPerfil } from "./conta/MeuPerfil";
import { MinhaAssinatura } from "./conta/MinhaAssinatura";
import { MinhasConquistas } from "./conta/MinhasConquistas";
import { PassportPaywall } from "./conta/PassportPaywall";
import { RankingTorcedores } from "./conta/Ranking";
import { seasonOfGame } from "../lib/gameSeason";
import { checkPassportAccess } from "../lib/passportAccess";


const BASE_CITY_KEY = "tripsz_base_city";

function BuscarJogos({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [user, setUser] = useState({ id: null, name: "", avatar: null });
  const [date, setDate] = useState(todayInSaoPaulo());
  const [cityQuery, setCityQuery] = useState("");
  const [city, setCity] = useState(null); // { label, name, lat, lon }
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [radius, setRadius] = useState(150);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searchedWith, setSearchedWith] = useState(null);
  const [error, setError] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [addingId, setAddingId] = useState(null);
  const [lastAdded, setLastAdded] = useState(null);

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
      const { data: rows } = await supabase.from("saved_games").select("fixture_id").eq("user_id", u.id);
      setSavedIds(new Set((rows || []).map((r) => r.fixture_id)));
    })();
    // Lembra a última cidade-base, pra pessoa não digitar toda vez.
    try {
      const raw = localStorage.getItem(BASE_CITY_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.label) {
          setCity(saved);
          setCityQuery(saved.label);
        }
      }
    } catch {
      // sem acesso ao armazenamento do navegador — segue sem lembrar
    }
  }, []);

  // Autocomplete da cidade-base.
  useEffect(() => {
    const q = cityQuery.trim();
    if ((city && q === city.label) || q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities/suggest?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setSuggestions(json.suggestions || []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [cityQuery, city]);

  const pickCity = (s) => {
    setCity(s);
    setCityQuery(s.label);
    setSuggestions([]);
    setShowSuggestions(false);
    try {
      localStorage.setItem(BASE_CITY_KEY, JSON.stringify(s));
    } catch {
      // idem
    }
  };

  const handleSearch = async () => {
    setError(null);
    setLastAdded(null);
    let chosen = city;
    // Digitou mas não clicou na sugestão? Usa a primeira (a mais populosa).
    if (!chosen && suggestions.length > 0) {
      chosen = suggestions[0];
      pickCity(chosen);
    }
    if (!chosen) {
      setError("Escolha uma cidade-base da lista de sugestões.");
      return;
    }
    if (!date) {
      setError("Escolha a data do jogo.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ date, lat: String(chosen.lat), lon: String(chosen.lon), radius: String(radius) });
      if (chosen.country) params.set("country", chosen.country);
      const res = await fetch(`/api/games/search?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setResult(null);
        setSearchedWith(null);
        setError(json.message || "Não foi possível buscar os jogos agora.");
        return;
      }
      setResult(json);
      setSearchedWith({ date, radius, cityLabel: chosen.label });
    } catch {
      setResult(null);
      setError("Não foi possível buscar os jogos agora. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (g) => {
    if (!user.id || savedIds.has(g.id) || addingId) return;
    setAddingId(g.id);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { error: insertError } = await supabase.from("saved_games").insert({
        user_id: user.id,
        fixture_id: g.id,
        kickoff: g.kickoff,
        league_name: g.league,
        league_country: g.leagueCountry,
        home_team: g.home,
        home_logo: g.homeLogo,
        away_team: g.away,
        away_logo: g.awayLogo,
        venue_name: g.venue,
        venue_city: g.city,
      });
      // 23505 = esse jogo já estava salvo — trata como sucesso.
      if (insertError && insertError.code !== "23505") throw insertError;
      setSavedIds((prev) => new Set(prev).add(g.id));
      setLastAdded(`${teamLabel(g.home)} × ${teamLabel(g.away)}`);
    } catch {
      setError("Não foi possível adicionar ao calendário agora. Tente de novo.");
    } finally {
      setAddingId(null);
    }
  };

  const labelStyle = { fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 };
  const fieldStyle = { background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, height: 48, padding: "0 14px", width: "100%", boxSizing: "border-box", fontFamily: FONT_DISPLAY, fontSize: 16, color: TEXT, outline: "none" };
  const cityShort = searchedWith ? cityShortName(searchedWith.cityLabel) : "";

  const renderGame = (g) => {
      const p = kickoffParts(g.kickoff);
      const saved = savedIds.has(g.id);
      const noTime = g.status === "PST" || g.status === "TBD";
      const league = g.leagueCountry && g.leagueCountry !== "World" ? `${g.league} • ${g.leagueCountry}` : g.league;
      return (
        <div key={g.id} style={{ background: "#fff", border: `${saved ? 1.5 : 1}px solid ${saved ? GREEN : BORDER}`, borderRadius: 12, padding: isMobile ? 16 : "20px 24px", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 12 : 32 }}>
          <div style={{ width: isMobile ? "auto" : 96, flexShrink: 0, display: "flex", flexDirection: isMobile ? "row" : "column", alignItems: isMobile ? "baseline" : "flex-start", gap: isMobile ? 10 : 2 }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, margin: 0 }}>{p.dayMonthYear}</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: TEXT, margin: 0 }}>{noTime ? "A definir" : p.time}</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{p.weekdayLong}</p>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: "#008a3a", textTransform: "uppercase", margin: 0 }}>{league}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <TeamBadge name={g.home} url={g.homeLogo} size={26} resolve />
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{teamLabel(g.home)} × {teamLabel(g.away)}</p>
              <TeamBadge name={g.away} url={g.awayLogo} size={26} resolve />
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <MapPin size={14} color={MUTED} style={{ flexShrink: 0 }} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: 0 }}>{[g.venue, g.city].filter(Boolean).join(" • ") || "Estádio a confirmar"}</p>
            </div>
            {g.approxLocation && <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>Local provável — confirme o estádio</p>}
          </div>
          <div style={{ width: isMobile ? "auto" : 90, flexShrink: 0, textAlign: isMobile ? "left" : "center" }}>
            {g.distanceKm == null ? (
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, color: MUTED, margin: 0 }}>distância indisponível</p>
            ) : (
              <>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{g.distanceKm} km</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, color: MUTED, margin: 0 }}>de {cityShort}</p>
              </>
            )}
          </div>
          {saved ? (
            <div style={{ background: "#eafbf1", borderRadius: 8, padding: "12px 18px", display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={16} color="#008a3a" />
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#008a3a", margin: 0, whiteSpace: "nowrap" }}>No meu calendário</p>
            </div>
          ) : (
            <div onClick={() => handleAdd(g)} style={{ background: GREEN, opacity: addingId === g.id ? 0.6 : 1, borderRadius: 8, padding: "12px 18px", display: "flex", gap: 8, alignItems: "center", justifyContent: "center", cursor: addingId ? "default" : "pointer", flexShrink: 0 }}>
              <Plus size={16} color="#fff" />
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", margin: 0, whiteSpace: "nowrap" }}>{addingId === g.id ? "Adicionando..." : "Adicionar ao calendário"}</p>
            </div>
          )}
        </div>
      );
  };


  return (
    <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
      <AuthedNav active="buscar" userName={user.name} userAvatar={user.avatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ background: "linear-gradient(180deg, #e6f5ec 0%, #f8fafc 100%)", padding: isMobile ? `32px ${px}` : `56px ${px}`, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          <div style={{ background: "#eafbf1", padding: "6px 12px", borderRadius: 4, width: "fit-content" }}>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: "#008a3a", margin: 0 }}>FUTEBOL PELO CAMINHO</p>
          </div>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 36 : 56, lineHeight: 1.05, color: TEXT, margin: 0 }}>Buscar jogos</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 16 : 18, lineHeight: 1.5, color: BODY, margin: 0 }}>Escolha uma data e uma cidade. Encontre sua próxima experiência de arquibancada.</p>
        </div>
        <div onClick={() => onNavigate("calendario")} style={{ background: BG_ALT, borderRadius: 8, padding: "13px 20px", display: "flex", gap: 8, alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
          <Calendar size={20} color={TEXT} />
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0, whiteSpace: "nowrap" }}>Meu calendário</p>
        </div>
      </div>

      <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: isMobile ? `24px ${px}` : `32px ${px}`, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-end", gap: isMobile ? 16 : 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: isMobile ? "100%" : 200 }}>
            <p style={labelStyle}>Data do jogo</p>
            <input type="date" value={date} min={todayInSaoPaulo()} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: isMobile ? "none" : 1, minWidth: 0, position: "relative" }}>
            <p style={labelStyle}>Cidade-base</p>
            <input
              value={cityQuery}
              onChange={(e) => {
                setCityQuery(e.target.value);
                if (city && e.target.value !== city.label) setCity(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Digite uma cidade (ex: São Paulo)"
              style={fieldStyle}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", zIndex: 30, overflow: "hidden" }}>
                {suggestions.map((s) => (
                  <div key={s.label} onMouseDown={() => pickCity(s)} style={{ padding: "12px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 10, alignItems: "center" }}>
                    <MapPin size={14} color={MUTED} />
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={labelStyle}>Raio de busca</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {RADIUS_OPTIONS.map((r) => (
                <div key={r} onClick={() => setRadius(r)} style={{ background: radius === r ? GREEN : BG_ALT, padding: "10px 16px", borderRadius: 999, cursor: "pointer" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: radius === r ? 700 : 500, fontSize: 13, color: radius === r ? "#fff" : BODY, margin: 0, whiteSpace: "nowrap" }}>{r} km</p>
                </div>
              ))}
            </div>
          </div>
          <div onClick={loading ? undefined : handleSearch} style={{ background: GREEN, opacity: loading ? 0.6 : 1, padding: "13px 20px", borderRadius: 8, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", cursor: loading ? "default" : "pointer", flexShrink: 0, height: 48, boxSizing: "border-box" }}>
            <Icon name="search" size={18} color="#fff" />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0, whiteSpace: "nowrap" }}>{loading ? "Buscando..." : "Buscar jogos"}</p>
          </div>
        </div>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, lineHeight: 1.4, color: MUTED, margin: 0 }}>
          Distâncias aproximadas em linha reta, medidas a partir da cidade escolhida. Horários de Brasília.
        </p>
      </div>

      <div style={{ background: BG_ALT, padding: isMobile ? `24px ${px}` : `40px ${px}`, display: "flex", flexDirection: "column", gap: 24, minHeight: 240 }}>
        {lastAdded && (
          <div style={{ background: "#eafbf1", borderRadius: 8, padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={13} color="#fff" />
            </div>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0, flex: 1, minWidth: 200 }}>{lastAdded} foi adicionado ao seu calendário.</p>
            <p onClick={() => onNavigate("calendario")} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#008a3a", margin: 0, cursor: "pointer", whiteSpace: "nowrap" }}>Ver Meu calendário →</p>
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#991b1b", margin: 0 }}>{error}</p>
          </div>
        )}

        {loading && <Loading text="Buscando jogos..." compact />}

        {!loading && !result && !error && (
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Escolha a data, a cidade-base e o raio, e toque em “Buscar jogos”.</p>
        )}

        {!loading && result && searchedWith && (
          <>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: TEXT, margin: 0 }}>
                  {result.total} {result.total === 1 ? "jogo encontrado" : "jogos encontrados"}
                </p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>
                  {formatLongDate(searchedWith.date)} • Até {searchedWith.radius} km de {cityWithoutCountry(searchedWith.cityLabel)}
                </p>
              </div>
              {result.total > 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>Mais perto da cidade-base</p>}
            </div>

            <div style={{ background: GOLD_BG, borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
              <Info size={18} color={GOLD} style={{ flexShrink: 0 }} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.5, color: BODY, margin: 0 }}>
                Datas e horários podem mudar — confira no site oficial do clube antes de ir. Salvar um jogo não reserva ingressos.
              </p>
            </div>

            {result.stale && (
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: GOLD, margin: 0 }}>Nossa fonte de dados está instável agora — esses jogos podem estar um pouco desatualizados.</p>
            )}

            {result.total === 0 && !(result.unconfirmed || []).length ? (
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Nenhum jogo encontrado nesse raio</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Tente aumentar o raio de busca ou escolher outra data.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {result.games.map(renderGame)}
              </div>
            )}

            {(result.unconfirmed || []).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Estádio não confirmado</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>
                    Jogos do mesmo país ainda sem local definido — podem estar dentro ou fora do raio escolhido.
                  </p>
                </div>
                {result.unconfirmed.map(renderGame)}
              </div>
            )}

            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, textAlign: "center", margin: 0 }}>
              TODOS OS JOGOS DESTA BUSCA • Ajuste a data ou o raio para explorar mais.
            </p>
          </>
        )}
      </div>

      <AuthedFooter />
    </div>
  );
}

function MeuCalendario({ onNavigate, onLogout }) {
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

function MeusJogosHistorico({ onNavigate, onLogout, onRegisterNew }) {
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

/* --- Registrar Jogo: fluxo guiado, busca por estádio na API-Football --- */
function RegistrarJogo({ onNavigate, onLogout, onDone }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);

  const [stadiumQuery, setStadiumQuery] = useState("");
  const [searchMode, setSearchMode] = useState("estadio"); // "estadio" | "clube"
  const [seasonValue, setSeasonValue] = useState(() => seasonOptionGroups().eu[0].value); // "eu:2026" (2026/27) ou "cal:2026" (ano de 2026)
  const { year: season, label: seasonText } = parseSeasonValue(seasonValue);
  const [competitionFilter, setCompetitionFilter] = useState("todas");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [venue, setVenue] = useState(null);
  const [games, setGames] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ home: "", away: "", date: "", stadium: "", city: "", country: "", competition: "" });
  const [access, setAccess] = useState(null);
  const [addedThisSession, setAddedThisSession] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [csvRows, setCsvRows] = useState([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [csvBatchIndex, setCsvBatchIndex] = useState(0);
  const [csvResolving, setCsvResolving] = useState(null); // { done, total } enquanto reconhece os jogos
  const [csvNote, setCsvNote] = useState(null);
  const CSV_BATCH_SIZE = 10;
  // Autocomplete nos campos de cada card do lote — guarda qual
  // linha+campo está em foco, e as sugestões pra ele, só um de cada vez.
  const [csvActiveField, setCsvActiveField] = useState(null); // { rowId, field: 'stadium' | 'home' | 'away' }
  const [csvSuggestions, setCsvSuggestions] = useState([]);
  const [csvSuggestLoading, setCsvSuggestLoading] = useState(false);
  const [csvSuggestError, setCsvSuggestError] = useState(null);

  useEffect(() => {
    if (!csvActiveField) return;
    const row = csvRows.find((r) => r.rowId === csvActiveField.rowId);
    const query = (row ? row[csvActiveField.field] : "").trim();
    if (!query || query.length < 3) {
      setCsvSuggestions([]);
      setCsvSuggestLoading(false);
      setCsvSuggestError(null);
      return;
    }
    setCsvSuggestLoading(true);
    setCsvSuggestError(null);
    const timer = setTimeout(async () => {
      try {
        const url = csvActiveField.field === "stadium"
          ? `/api/attended-games/search-stadium/suggest?q=${encodeURIComponent(query)}`
          : `/api/teams/suggest?q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        setCsvSuggestions(data.suggestions || []);
      } catch (e) {
        setCsvSuggestions([]);
        setCsvSuggestError("Erro ao buscar — tenta de novo em instantes.");
      } finally {
        setCsvSuggestLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvActiveField, csvRows]);

  const pickCsvSuggestion = (rowId, field, value, logo) => {
    updateCsvRow(rowId, field, value);
    if (field === "home") updateCsvRow(rowId, "homeLogo", logo || null);
    if (field === "away") updateCsvRow(rowId, "awayLogo", logo || null);
    setCsvActiveField(null);
    setCsvSuggestions([]);
  };

  // Autocomplete com debounce — só busca sugestões depois que a pessoa
  // parar de digitar por meio segundo, e só a partir de 3 letras, pra
  // não gastar a cota da API a cada tecla apertada.
  useEffect(() => {
    if (stadiumQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const endpoint = searchMode === "clube"
          ? `/api/teams/suggest?q=${encodeURIComponent(stadiumQuery)}`
          : searchMode === "selecao"
          ? `/api/teams/suggest?q=${encodeURIComponent(stadiumQuery)}&mode=selecao`
          : `/api/attended-games/search-stadium/suggest?q=${encodeURIComponent(stadiumQuery)}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [stadiumQuery, searchMode]);

  const pickSuggestion = (name) => {
    setStadiumQuery(name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  useEffect(() => {
    (async () => {
      const acc = await checkPassportAccess();
      setAccess(acc);
      if (!acc.hasAccess) return;

      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      setUserName(data.user?.user_metadata?.name || data.user?.email || "");
      setUserAvatar(data.user?.user_metadata?.avatar_url || null);
    })();
  }, []);

  const handleSearch = async () => {
    if (!stadiumQuery.trim()) return setError(searchMode === "clube" ? "Digite o nome de um clube." : searchMode === "selecao" ? "Digite o nome de uma seleção." : "Digite o nome de um estádio.");
    setError(null);
    setLoading(true);
    setVenue(null);
    setGames([]);
    setSelectedIds(new Set());
    setCompetitionFilter("todas");
    try {
      if (searchMode === "clube" || searchMode === "selecao") {
        const modeParam = searchMode === "selecao" ? "&mode=selecao" : "";
        const res = await fetch(`/api/attended-games/search-team?team=${encodeURIComponent(stadiumQuery)}&season=${season}${modeParam}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro na busca.");
        if (!data.found) {
          setShowManual(true);
          setManual((m) => ({ ...m, home: stadiumQuery }));
          const noun = searchMode === "selecao" ? "a seleção" : "o clube";
          setError(data.reason === "sem_jogos_no_periodo" ? `Encontramos ${noun}, mas nenhum jogo na temporada ${seasonText} — tente outro ano, ou preencha manualmente.` : `Não encontramos ${searchMode === "selecao" ? "essa seleção" : "esse clube"} na nossa base — preencha manualmente.`);
          return;
        }
        setVenue({ name: data.club.name, city: data.club.city, country: data.club.country, logo: data.club.logo, isClub: true });
        setGames(data.games);
        setShowManual(false);
        return;
      }

      const res = await fetch(`/api/attended-games/search-stadium?stadium=${encodeURIComponent(stadiumQuery)}&season=${season}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na busca.");
      if (!data.found) {
        setShowManual(true);
        if (data.reason === "sem_jogos_no_periodo") {
          setManual((m) => ({ ...m, stadium: data.venue?.name || stadiumQuery, city: data.venue?.city || "", country: data.venue?.country || "" }));
          setError(`Encontramos o estádio, mas nenhum jogo na temporada ${seasonText} — tente outro ano, ou preencha manualmente.`);
        } else {
          setError("Não encontramos esse estádio na nossa base — preencha manualmente.");
        }
        return;
      }
      setVenue(data.venue);
      setGames(data.games);
      setShowManual(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const [savingId, setSavingId] = useState(null);

  // Clicar em "+ Adicionar" já salva aquele jogo na hora — antes exigia
  // um segundo clique em "Adicionar à viagem" pra confirmar em lote, o
  // que dava a impressão de que nada tinha sido salvo.
  const handleAddGame = async (g) => {
    if (selectedIds.has(g.apiFixtureId) || savingId) return;
    if (access && !access.isPaid && access.gamesCount + addedThisSession >= access.gamesLimit) {
      setError(`Você atingiu o limite de ${access.gamesLimit} jogos do plano grátis. Assine pra registrar mais.`);
      return;
    }
    setSavingId(g.apiFixtureId);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");

      const { error: insertError } = await supabase.from("attended_games").insert({
        user_id: userId,
        source: "api",
        api_fixture_id: g.apiFixtureId,
        home_team: g.home,
        away_team: g.away,
        home_logo: g.homeLogo,
        away_logo: g.awayLogo,
        home_score: g.homeScore,
        away_score: g.awayScore,
        match_date: g.date.split("T")[0],
        stadium: g.stadium || venue.name,
        city: g.city || venue.city,
        country: g.country || venue.country,
        competition: g.competition,
      });
      if (insertError) throw insertError;
      setSelectedIds((prev) => new Set(prev).add(g.apiFixtureId));
      setAddedThisSession((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  // Importação de CSV — não chama a API-Football pra nada aqui de
  // propósito (confirmar cada linha na API estouraria nossa cota
  // chamadas/dia rapidinho). Os dados vêm direto do que a pessoa trouxe.
  const CSV_TEMPLATE_HEADER = "data,estadio,cidade,pais,mandante,visitante,placar_mandante,placar_visitante,competicao";
  const downloadCsvTemplate = () => {
    const example = "2024-08-24,Anfield,Liverpool,Inglaterra,Liverpool,Brentford,2,1,Premier League";
    const blob = new Blob([`${CSV_TEMPLATE_HEADER}\n${example}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-jogos-tripsz.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Uma linha do export do Futbology -> linha de revisão. A leitura do texto
  // (letras disfarçadas, "M" apagado, data, placar) está em lib/futbologyParse.js;
  // quem descobre estádio/mandante/visitante é o reconhecimento automático
  // (resolveCsvRows, abaixo), que casa a linha com o jogo real.
  const toFutbologyRow = (rawLine, rowId) => {
    const p = parseFutbologyLine(rawLine);
    if (!p) return null;
    return {
      rowId,
      include: true,
      date: p.date,
      rawDate: p.rawDate || "(confira a data)",
      stadium: "",
      city: "",
      country: guessCountryFromCompetition(p.competition),
      home: "",
      away: "",
      combinedText: p.text, // estádio + mandante + visitante juntos
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      competition: p.competition,
      needsManualSplit: true,
      autoState: "pending", // pending | matched | unmatched
    };
  };

  // Reconhecimento automático: manda as linhas (poucas por vez, agrupadas por
  // data) pro servidor, que acha o jogo real e devolve times, escudos,
  // estádio, cidade e país.
  const resolveCsvRows = async (rows) => {
    const todo = rows.filter((r) => r.date && r.homeScore !== "").sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    if (todo.length === 0) return;
    const CHUNK = 6;
    let matched = 0;
    let planBlocked = false;
    setCsvNote(null);
    setCsvResolving({ done: 0, total: todo.length });
    for (let i = 0; i < todo.length; i += CHUNK) {
      const chunk = todo.slice(i, i + CHUNK);
      let results = [];
      try {
        const res = await authFetch("/api/attended-games/futbology-resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk.map((r) => ({ rowId: r.rowId, date: r.date, text: r.combinedText, homeScore: r.homeScore, awayScore: r.awayScore })) }),
        });
        const data = await res.json();
        if (res.ok) results = data.results || [];
      } catch {
        // falhou este lote: as linhas ficam pra preencher na mão
      }
      const byId = new Map(results.map((r) => [r.rowId, r]));
      if (results.some((r) => r.reason === "plano")) planBlocked = true;
      matched += results.filter((r) => r.match).length;
      setCsvRows((prev) =>
        prev.map((row) => {
          const r = byId.get(row.rowId);
          if (!r || row.autoState !== "pending") return row;
          if (!r.match) return { ...row, autoState: "unmatched" };
          const m = r.match;
          return {
            ...row,
            autoState: "matched",
            needsManualSplit: false,
            home: m.home,
            away: m.away,
            homeLogo: m.homeLogo,
            awayLogo: m.awayLogo,
            stadium: m.stadium || "",
            city: m.city || "",
            country: m.country || row.country,
            competition: m.competition || row.competition,
            apiFixtureId: m.apiFixtureId,
          };
        })
      );
      setCsvResolving({ done: Math.min(i + CHUNK, todo.length), total: todo.length });
    }
    setCsvResolving(null);
    setCsvRows((prev) => prev.map((row) => (row.autoState === "pending" ? { ...row, autoState: "unmatched" } : row)));
    setCsvNote(
      planBlocked
        ? `Reconhecemos ${matched} de ${todo.length} jogos. Os mais antigos não estão disponíveis na nossa fonte de dados — preencha esses à mão.`
        : `Reconhecemos ${matched} de ${todo.length} jogos automaticamente.${matched < todo.length ? " Os demais você completa abaixo." : ""}`
    );
  };

  const HEADER_ALIASES = {
    data: ["data", "date"],
    estadio: ["estadio", "estádio", "stadium", "venue"],
    cidade: ["cidade", "city"],
    pais: ["pais", "país", "country"],
    mandante: ["mandante", "home", "home_team", "mandante_time"],
    visitante: ["visitante", "away", "away_team"],
    placar_mandante: ["placar_mandante", "gols_mandante", "home_score"],
    placar_visitante: ["placar_visitante", "gols_visitante", "away_score"],
    competicao: ["competicao", "competição", "competition", "liga"],
  };

  const parseCsvDate = (raw) => {
    if (!raw) return null;
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (iso.test(raw.trim())) return raw.trim();
    const br = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    const d = new Date(raw);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
    return null;
  };

  const handleCsvFile = async (file) => {
    setCsvError(null);
    setCsvResult(null);
    setCsvFileName(file.name);
    setCsvBatchIndex(0);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setCsvError("O arquivo está vazio ou só tem o cabeçalho.");
        return;
      }
      const rawHeaders = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
      const colIndex = {};
      Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
        const idx = rawHeaders.findIndex((h) => aliases.includes(h));
        if (idx !== -1) colIndex[key] = idx;
      });

      // Sem cabeçalho reconhecido, mas com o padrão "texto ; competição.%"
      // em pelo menos uma linha? Provavelmente é um export tipo
      // Futbology — usa o parser específico pra esse formato.
      if (colIndex.mandante === undefined || colIndex.visitante === undefined || colIndex.data === undefined) {
        const looksLikeFutbology = lines.some((l) => /;.*\.%\s*$/.test(l));
        if (looksLikeFutbology) {
          const rows = lines.map((line, i) => toFutbologyRow(line, i)).filter(Boolean);
          if (rows.length === 0) {
            setCsvError("Reconhecemos o formato Futbology, mas não conseguimos ler nenhuma linha dele. Confere se o arquivo não foi alterado.");
            return;
          }
          setCsvRows(rows);
          resolveCsvRows(rows);
          return;
        }
        setCsvError('O arquivo precisa ter pelo menos as colunas "data", "mandante" e "visitante". Baixe nosso modelo pra ver o formato certo.');
        return;
      }

      const rows = lines.slice(1).map((line, i) => {
        const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const get = (key) => (colIndex[key] !== undefined ? cells[colIndex[key]] || "" : "");
        return {
          rowId: i,
          include: true,
          date: parseCsvDate(get("data")),
          rawDate: get("data"),
          stadium: get("estadio"),
          city: get("cidade"),
          country: get("pais"),
          home: get("mandante"),
          away: get("visitante"),
          homeScore: get("placar_mandante"),
          awayScore: get("placar_visitante"),
          competition: get("competicao"),
        };
      });
      setCsvRows(rows);
    } catch (e) {
      setCsvError("Não foi possível ler esse arquivo. Confirma que é um .csv de verdade.");
    }
  };

  const updateCsvRow = (rowId, field, value) => {
    setCsvRows((rows) => rows.map((r) => (r.rowId === rowId ? { ...r, [field]: value } : r)));
  };

  const handleCsvImport = async (uptoIndex) => {
    const reviewedRows = uptoIndex !== undefined ? csvRows.slice(0, uptoIndex) : csvRows;
    const toImport = reviewedRows.filter((r) => r.include && r.date && r.home && r.away && r.country);
    const skippedCount = reviewedRows.length - toImport.length;
    if (toImport.length === 0) {
      setCsvError("Nenhum jogo revisado até aqui ficou pronto pra importar — confirma que pelo menos um tem data, mandante, visitante e país preenchidos, e não foi marcado como pulado.");
      return;
    }
    setCsvImporting(true);
    setCsvError(null);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");

      let successCount = 0;
      let failCount = 0;
      for (const row of toImport) {
        const { error: insertError } = await supabase.from("attended_games").insert({
          user_id: userId,
          source: "csv",
          api_fixture_id: row.apiFixtureId || null,
          home_team: row.home,
          away_team: row.away,
          home_logo: row.homeLogo || null,
          away_logo: row.awayLogo || null,
          home_score: row.homeScore ? parseInt(row.homeScore, 10) : null,
          away_score: row.awayScore ? parseInt(row.awayScore, 10) : null,
          match_date: row.date,
          stadium: row.stadium || null,
          city: row.city || null,
          country: row.country,
          competition: row.competition || null,
        });
        if (insertError) failCount += 1;
        else successCount += 1;
      }
      setCsvResult({ successCount, skippedCount: skippedCount + failCount });
      setCsvRows([]);
    } catch (e) {
      setCsvError(e.message || "Não foi possível importar os jogos.");
    } finally {
      setCsvImporting(false);
    }
  };

  const handleManualSave = async () => {
    if (!manual.home || !manual.away || !manual.date || !manual.country) {
      return setError("Preencha pelo menos os times, a data e o país.");
    }
    if (access && !access.isPaid && access.gamesCount + addedThisSession >= access.gamesLimit) {
      return setError(`Você atingiu o limite de ${access.gamesLimit} jogos do plano grátis. Assine pra registrar mais.`);
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");
      const { error: insertError } = await supabase.from("attended_games").insert({
        user_id: userId,
        source: "manual",
        home_team: manual.home,
        away_team: manual.away,
        match_date: manual.date,
        stadium: manual.stadium || null,
        city: manual.city || null,
        country: manual.country,
        competition: manual.competition || null,
      });
      if (insertError) throw insertError;
      setAddedThisSession((n) => n + 1);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = { width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, outline: "none" };
  const distinctCompetitions = [...new Set(games.map((g) => g.competition).filter(Boolean))];
  const filteredGames = competitionFilter === "todas" ? games : games.filter((g) => g.competition === competitionFilter);

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
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 40, lineHeight: 1.1, color: TEXT, margin: 0 }}>Registre um Jogo</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, lineHeight: 1.5, color: BODY, margin: 0 }}>Adicione jogos que você já esteve para completar seu Football Passport e subir seu nível de torcedor.</p>
        {!access.isPaid && (() => {
          const used = Math.min(access.gamesCount + addedThisSession, access.gamesLimit);
          const pct = Math.round((used / access.gamesLimit) * 100);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: used >= access.gamesLimit ? "#dc2626" : MUTED, margin: 0 }}>
                {used}/{access.gamesLimit} jogos do plano grátis
              </p>
              <div style={{ background: BG_ALT, height: 6, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ background: used >= access.gamesLimit ? "#dc2626" : GREEN, height: "100%", width: `${pct}%`, borderRadius: 999 }} />
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{ background: BG_ALT, display: "flex", flexDirection: "column", alignItems: "center", padding: isMobile ? `24px ${px}` : `80px ${px}` }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 40, width: "100%", maxWidth: 960, display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
            <div>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Etapa 1 · Busca</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: "6px 0 0" }}>Busque pelo estádio ou clube</p>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
              {[["estadio", "Estádio"], ["clube", "Clube"], ["selecao", "Seleção"], ["futbology", "Futbology"]].map(([mode, label]) => (
                <div key={mode} onClick={() => { setSearchMode(mode); setStadiumQuery(""); setVenue(null); setGames([]); setShowManual(false); setError(null); }} style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: searchMode === mode ? TEXT : MUTED, margin: 0 }}>{label}</p>
                    {mode === "futbology" && !access.isPaid && <Lock size={12} color={MUTED} />}
                  </div>
                  <div style={{ background: searchMode === mode ? GREEN : BORDER, height: 2, borderRadius: 1, width: searchMode === mode ? 72 : 44 }} />
                </div>
              ))}
            </div>
            {searchMode === "futbology" && !access.isPaid && (
              <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 12, width: "100%", alignItems: "flex-start" }}>
                <div style={{ background: GREEN_BG, width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Lock size={18} color={GREEN} />
                </div>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Importação em massa é só pra assinantes</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.5, maxWidth: 480 }}>
                  Se você já tem um histórico grande de jogos (de outro app, tipo o Futbology), importar tudo de uma vez é um recurso da assinatura. No plano grátis, você pode registrar até {access.gamesLimit} jogos um por um nas outras abas.
                </p>
                <div onClick={() => onNavigate("assinatura")} style={{ background: GREEN, padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", textTransform: "uppercase", margin: 0 }}>Ver planos</p>
                </div>
              </div>
            )}
            {searchMode === "futbology" && access.isPaid && (
              <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                <div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, margin: 0 }}>Importar jogos de um arquivo CSV</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: "4px 0 0", lineHeight: 1.5 }}>
                    Se você tem seus jogos num app tipo o Futbology, exporte como CSV e importe aqui. No formato do Futbology a gente reconhece cada jogo sozinho (times, escudos, estádio, cidade e país) — você só confere.
                  </p>
                </div>
                <div onClick={downloadCsvTemplate} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", width: "fit-content" }}>
                  <Download size={14} color={GREEN} />
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>Baixar modelo de CSV</p>
                </div>
                <div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
                    style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: TEXT }}
                  />
                </div>
                {csvError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{csvError}</p>}
                {csvResolving && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Reconhecendo seus jogos… {csvResolving.done}/{csvResolving.total}</p>
                    <div style={{ background: BG, border: `1px solid ${BORDER}`, height: 8, borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ background: GREEN, height: "100%", width: `${Math.round((csvResolving.done / csvResolving.total) * 100)}%`, borderRadius: 999 }} />
                    </div>
                  </div>
                )}
                {!csvResolving && csvNote && csvRows.length > 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: 0 }}>{csvNote}</p>}
                {csvResult && (
                  <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Resumo final</p>
                    <div style={{ display: "flex", gap: 16, flexDirection: isMobile ? "column" : "row" }}>
                      <div style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Importados</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: TEXT, margin: "4px 0" }}>{csvResult.successCount}</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Jogos adicionados ao seu histórico</p>
                      </div>
                      <div style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Pulados</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: TEXT, margin: "4px 0" }}>{csvResult.skippedCount}</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Marcados como pular ou com dado faltando</p>
                      </div>
                    </div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Os jogos importados foram adicionados ao seu Football Passport.</p>
                    <div onClick={() => onNavigate("jogos")} style={{ background: GREEN, padding: "14px 24px", borderRadius: 8, textAlign: "center", cursor: "pointer", width: "fit-content" }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", margin: 0 }}>Ver meus jogos</p>
                    </div>
                  </div>
                )}
                {csvRows.length > 0 && (() => {
                  const totalRows = csvRows.length;
                  const batchStart = csvBatchIndex * CSV_BATCH_SIZE;
                  const batchEnd = Math.min(batchStart + CSV_BATCH_SIZE, totalRows);
                  const currentBatch = csvRows.slice(batchStart, batchEnd);
                  const isFirstBatch = csvBatchIndex === 0;
                  const isLastBatch = batchEnd >= totalRows;
                  const progressPct = Math.round((batchEnd / totalRows) * 1000) / 10;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Confirmando {batchStart + 1}–{batchEnd} de {totalRows} jogos</p>
                          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, margin: 0 }}>{progressPct}% ({batchEnd}/{totalRows})</p>
                        </div>
                        <div style={{ background: BG, border: `1px solid ${BORDER}`, height: 8, borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ background: GREEN, height: "100%", width: `${progressPct}%`, borderRadius: 999 }} />
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {currentBatch.map((row) => {
                          const isValid = row.date && row.home && row.away && row.country;
                          return (
                            <div key={row.rowId} style={{ background: BG, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 16, opacity: row.include ? 1 : 0.5 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Data</p>
                                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{row.rawDate || "—"}</p>
                                </div>
                                <div style={{ background: isValid ? BORDER : "#fecaca", borderRadius: 999, padding: "8px 12px" }}>
                                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: isValid ? MUTED : "#dc2626", margin: 0 }}>{row.autoState === "pending" ? "reconhecendo…" : row.autoState === "matched" && isValid ? "reconhecido ✓" : isValid ? "já identificado" : "falta dado"}</p>
                                </div>
                              </div>
                              <div>
                                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Competição</p>
                                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: "2px 0 0" }}>{row.competition || "—"}</p>
                                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: "6px 0 0" }}>{teamLabel(row.home) || "?"} {row.homeScore ?? ""}×{row.awayScore ?? ""} {teamLabel(row.away) || "?"}</p>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ position: "relative" }}>
                                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Estádio</p>
                                  <input
                                    value={row.stadium}
                                    onChange={(e) => updateCsvRow(row.rowId, "stadium", e.target.value)}
                                    onFocus={() => setCsvActiveField({ rowId: row.rowId, field: "stadium" })}
                                    onBlur={() => setTimeout(() => setCsvActiveField(null), 150)}
                                    placeholder="Comece a digitar pra ver sugestões"
                                    style={{ width: "100%", background: "#fff", border: "none", borderRadius: 8, padding: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: TEXT, marginTop: 4, boxSizing: "border-box" }}
                                  />
                                  {csvActiveField?.rowId === row.rowId && csvActiveField?.field === "stadium" && row.stadium.trim().length >= 3 && (
                                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", maxHeight: 200, overflowY: "auto", zIndex: 30 }}>
                                      {csvSuggestLoading && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Buscando...</p>}
                                      {!csvSuggestLoading && csvSuggestError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", padding: "10px 14px", margin: 0 }}>{csvSuggestError}</p>}
                                      {!csvSuggestLoading && !csvSuggestError && csvSuggestions.length === 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Nenhum resultado — confirma a grafia ou deixa assim mesmo.</p>}
                                      {!csvSuggestLoading && csvSuggestions.map((s) => (
                                        <div
                                          key={s.name}
                                          onMouseDown={() => {
                                            updateCsvRow(row.rowId, "stadium", s.name);
                                            if (s.country) updateCsvRow(row.rowId, "country", s.country);
                                            if (s.city) updateCsvRow(row.rowId, "city", s.city);
                                            setCsvActiveField(null);
                                            setCsvSuggestions([]);
                                          }}
                                          style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                                        >
                                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{teamLabel(s.name)}</p>
                                          {(s.city || s.country) && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, color: MUTED, margin: 0 }}>{[s.city, s.country].filter(Boolean).join(", ")}</p>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <div style={{ flex: 1, position: "relative" }}>
                                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Mandante</p>
                                    <input
                                      value={row.home}
                                      onChange={(e) => { updateCsvRow(row.rowId, "home", e.target.value); updateCsvRow(row.rowId, "homeLogo", null); }}
                                      onFocus={() => setCsvActiveField({ rowId: row.rowId, field: "home" })}
                                      onBlur={() => setTimeout(() => setCsvActiveField(null), 150)}
                                      style={{ width: "100%", background: "#fff", border: "none", borderRadius: 8, padding: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: TEXT, marginTop: 4, boxSizing: "border-box" }}
                                    />
                                    {csvActiveField?.rowId === row.rowId && csvActiveField?.field === "home" && row.home.trim().length >= 3 && (
                                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", maxHeight: 200, overflowY: "auto", zIndex: 30 }}>
                                        {csvSuggestLoading && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Buscando...</p>}
                                        {!csvSuggestLoading && csvSuggestError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", padding: "10px 14px", margin: 0 }}>{csvSuggestError}</p>}
                                        {!csvSuggestLoading && !csvSuggestError && csvSuggestions.length === 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Nenhum resultado — confirma a grafia ou deixa assim mesmo.</p>}
                                        {!csvSuggestLoading && csvSuggestions.map((s) => (
                                          <div key={s.name} onMouseDown={() => pickCsvSuggestion(row.rowId, "home", s.name, s.logo)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                                            <TeamBadge name={s.name} url={s.logo} size={20} />
                                            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{teamLabel(s.name)}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, position: "relative" }}>
                                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Visitante</p>
                                    <input
                                      value={row.away}
                                      onChange={(e) => { updateCsvRow(row.rowId, "away", e.target.value); updateCsvRow(row.rowId, "awayLogo", null); }}
                                      onFocus={() => setCsvActiveField({ rowId: row.rowId, field: "away" })}
                                      onBlur={() => setTimeout(() => setCsvActiveField(null), 150)}
                                      style={{ width: "100%", background: "#fff", border: "none", borderRadius: 8, padding: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: TEXT, marginTop: 4, boxSizing: "border-box" }}
                                    />
                                    {csvActiveField?.rowId === row.rowId && csvActiveField?.field === "away" && row.away.trim().length >= 3 && (
                                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", maxHeight: 200, overflowY: "auto", zIndex: 30 }}>
                                        {csvSuggestLoading && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Buscando...</p>}
                                        {!csvSuggestLoading && csvSuggestError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", padding: "10px 14px", margin: 0 }}>{csvSuggestError}</p>}
                                        {!csvSuggestLoading && !csvSuggestError && csvSuggestions.length === 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Nenhum resultado — confirma a grafia ou deixa assim mesmo.</p>}
                                        {!csvSuggestLoading && csvSuggestions.map((s) => (
                                          <div key={s.name} onMouseDown={() => pickCsvSuggestion(row.rowId, "away", s.name, s.logo)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                                            <TeamBadge name={s.name} url={s.logo} size={20} />
                                            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{teamLabel(s.name)}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <input value={row.country} onChange={(e) => updateCsvRow(row.rowId, "country", e.target.value)} placeholder="País (obrigatório)" style={{ flex: 1, background: "#fff", border: `1px solid ${row.country ? BORDER : "#dc2626"}`, borderRadius: 8, padding: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: TEXT, boxSizing: "border-box" }} />
                                  <input value={row.city} onChange={(e) => updateCsvRow(row.rowId, "city", e.target.value)} placeholder="Cidade" style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: TEXT, boxSizing: "border-box" }} />
                                </div>
                              </div>
                              {row.needsManualSplit && row.autoState !== "pending" && (
                                <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: 12 }}>
                                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: "#92400e", textTransform: "uppercase", margin: 0 }}>Não reconhecemos este jogo — texto original do Futbology</p>
                                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#92400e", margin: "6px 0 0", lineHeight: 1.5 }}>{row.combinedText}{row.competition ? ` — ${row.competition}` : ""}</p>
                                </div>
                              )}
                              <div onClick={() => updateCsvRow(row.rowId, "include", !row.include)} style={{ background: "#fff", padding: "10px 16px", borderRadius: 8, textAlign: "center", cursor: "pointer", width: "fit-content" }}>
                                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{row.include ? "Pular este jogo" : "Desmarcar pular"}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
                        <div onClick={isFirstBatch ? undefined : () => setCsvBatchIndex((i) => i - 1)} style={{ background: "#fff", border: `1px solid ${BORDER}`, padding: "14px 24px", borderRadius: 8, textAlign: "center", cursor: isFirstBatch ? "default" : "pointer", opacity: isFirstBatch ? 0.4 : 1 }}>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>← Lote anterior</p>
                        </div>
                        <div onClick={isLastBatch ? undefined : () => setCsvBatchIndex((i) => i + 1)} style={{ background: "#fff", border: `1px solid ${BORDER}`, padding: "14px 24px", borderRadius: 8, textAlign: "center", cursor: isLastBatch ? "default" : "pointer", opacity: isLastBatch ? 0.4 : 1 }}>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>Confirmar e ir pro próximo lote →</p>
                        </div>
                        <div onClick={csvImporting ? undefined : () => handleCsvImport(batchEnd)} style={{ background: GREEN_BUTTON, opacity: csvImporting ? 0.6 : 1, padding: "14px 24px", borderRadius: 8, textAlign: "center", cursor: csvImporting ? "default" : "pointer" }}>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{csvImporting ? "Importando..." : "Importar os confirmados até aqui"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {searchMode !== "futbology" && (
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, width: "100%" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: 14, borderRadius: 12 }}>
                  <Icon name="search" size={18} color={MUTED} />
                  <input
                    value={stadiumQuery}
                    onChange={(e) => setStadiumQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onKeyDown={(e) => e.key === "Enter" && (setShowSuggestions(false), handleSearch())}
                    placeholder={searchMode === "clube" ? "Buscar clube..." : searchMode === "selecao" ? "Buscar seleção (ex: Brasil)..." : "Buscar estádio..."}
                    style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT }}
                  />
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", zIndex: 20, overflow: "hidden" }}>
                    {suggestions.map((s) => (
                      <div
                        key={s.name}
                        onMouseDown={() => pickSuggestion(s.name)}
                        style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                      >
                        {(searchMode === "clube" || searchMode === "selecao") && <TeamBadge name={s.name} url={s.logo} size={22} />}
                        <div>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{teamLabel(s.name)}</p>
                          {s.city && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{s.city}{s.country ? `, ${s.country}` : ""}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <select value={seasonValue} onChange={(e) => setSeasonValue(e.target.value)} style={{ ...fieldStyle, width: isMobile ? "100%" : 180 }}>
                <optgroup label="Temporada europeia (jul–jun)">
                  {seasonOptionGroups().eu.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Ano-calendário (jan–dez)">
                  {seasonOptionGroups().cal.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              </select>
              <div onClick={loading ? undefined : () => { setShowSuggestions(false); handleSearch(); }} style={{ background: GREEN_BUTTON, opacity: loading ? 0.6 : 1, padding: "14px 24px", borderRadius: 12, textAlign: "center", cursor: loading ? "default" : "pointer", whiteSpace: "nowrap" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{loading ? "Buscando..." : "Buscar"}</p>
              </div>
            </div>
            )}
            {venue && (
              <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {venue.isClub && <TeamBadge name={venue.name} url={venue.logo} size={40} />}
                  <div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{venue.name}</p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: "4px 0 0" }}>{venue.city}, {venue.country}{venue.capacity ? ` • Capacidade: ${venue.capacity.toLocaleString("pt-BR")}` : ""}</p>
                  </div>
                </div>
                <div style={{ background: GREEN_BG, display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: 999 }}>
                  <Check size={14} color={GREEN} />
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Selecionado</p>
                </div>
              </div>
            )}
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
          </div>

          {games.length > 0 && (
            <>
              <div style={{ height: 1, background: BORDER, width: "100%" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-end", gap: 12 }}>
                  <div>
                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Etapa 2 · Lista de jogos</p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: "6px 0 0" }}>Jogos disponíveis</p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: "4px 0 0" }}>{filteredGames.length} jogo(s) encontrado(s)</p>
                  </div>
                  {distinctCompetitions.length > 1 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: isMobile ? "100%" : 220 }}>
                      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Competição</p>
                      <select value={competitionFilter} onChange={(e) => setCompetitionFilter(e.target.value)} style={{ ...fieldStyle, padding: "10px 14px" }}>
                        <option value="todas">Todas as competições</option>
                        {distinctCompetitions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredGames.map((g) => {
                    const selected = selectedIds.has(g.apiFixtureId);
                    const isSaving = savingId === g.apiFixtureId;
                    return (
                      <div key={g.apiFixtureId} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>{new Date(g.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "4px 0", flexWrap: "wrap" }}>
                            <TeamBadge name={g.home} url={g.homeLogo} size={24} />
                            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{teamLabel(g.home)} {g.homeScore ?? "-"}×{g.awayScore ?? "-"} {teamLabel(g.away)}</p>
                            <TeamBadge name={g.away} url={g.awayLogo} size={24} />
                          </div>
                          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{g.competition}</p>
                        </div>
                        <div onClick={() => handleAddGame(g)} style={{ background: selected ? BORDER : GREEN_BUTTON, opacity: isSaving ? 0.6 : 1, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: 10, cursor: selected || isSaving ? "default" : "pointer", flexShrink: 0 }}>
                          {selected && <Check size={14} color={MUTED} />}
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: selected ? MUTED : "#fff", margin: 0 }}>{isSaving ? "Salvando..." : selected ? "Adicionado" : "+ Adicionar"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ height: 1, background: BORDER, width: "100%" }} />
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 16, width: "100%" }}>
                <div>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Etapa 3 · Concluir</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: "6px 0 0" }}>{selectedIds.size > 0 ? `${selectedIds.size} jogo(s) já adicionados ao seu Football Passport` : "Clique em \"+ Adicionar\" nos jogos que você quer registrar"}</p>
                </div>
                <div onClick={onDone} style={{ background: GREEN_BUTTON, padding: "14px 24px", borderRadius: 12, textAlign: "center", cursor: "pointer", whiteSpace: "nowrap" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>Concluir →</p>
                </div>
              </div>
            </>
          )}

          {showManual && (
            <>
              <div style={{ height: 1, background: BORDER, width: "100%" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: BODY, margin: 0 }}>Não encontramos esse estádio na nossa base. Preencha os dados manualmente — só entram nas suas estatísticas, sem verificação automática.</p>
                <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                  <input value={manual.home} onChange={(e) => setManual((m) => ({ ...m, home: e.target.value }))} placeholder="Time da casa" style={fieldStyle} />
                  <input value={manual.away} onChange={(e) => setManual((m) => ({ ...m, away: e.target.value }))} placeholder="Time visitante" style={fieldStyle} />
                </div>
                <input type="date" value={manual.date} max={new Date().toISOString().split("T")[0]} onChange={(e) => setManual((m) => ({ ...m, date: e.target.value }))} style={fieldStyle} />
                <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                  <input value={manual.stadium} onChange={(e) => setManual((m) => ({ ...m, stadium: e.target.value }))} placeholder="Estádio" style={fieldStyle} />
                  <input value={manual.city} onChange={(e) => setManual((m) => ({ ...m, city: e.target.value }))} placeholder="Cidade" style={fieldStyle} />
                </div>
                <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                  <input value={manual.country} onChange={(e) => setManual((m) => ({ ...m, country: e.target.value }))} placeholder="País" style={fieldStyle} />
                  <input value={manual.competition} onChange={(e) => setManual((m) => ({ ...m, competition: e.target.value }))} placeholder="Competição" style={fieldStyle} />
                </div>
                <div onClick={saving ? undefined : handleManualSave} style={{ background: GREEN_BUTTON, opacity: saving ? 0.6 : 1, padding: "14px 24px", borderRadius: 12, textAlign: "center", cursor: saving ? "default" : "pointer" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", margin: 0 }}>{saving ? "Salvando..." : "Salvar jogo"}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}


// Cada passo da jornada tem seu próprio endereço na barra do navegador —
// isso faz o botão voltar/avançar do navegador funcionar de verdade, e
// deixa visível em que momento da jornada a pessoa está.
const SCREEN_TO_PATH = {
  landing: "/",
  criarconta: "/criar-conta",
  assinar: "/assinar",
  account: "/comecar",
  destino: "/roteiro/destino",
  times: "/roteiro/times",
  datas: "/roteiro/datas",
  pessoas: "/roteiro/pessoas",
  preferencias: "/roteiro/preferencias",
  loading: "/roteiro/calculando",
  resultado: "/roteiro/resultado",
  checkout: "/checkout",
  roteiros: "/conta/roteiros",
  roteiro: "/conta/roteiros/detalhe",
  jogos: "/conta/jogos",
  buscar: "/conta/buscar-jogos",
  calendario: "/conta/calendario",
  "registrar-jogo": "/conta/jogos/registrar",
  nivel: "/conta/nivel",
  conquistas: "/conta/conquistas",
  perfil: "/conta/perfil",
  assinatura: "/conta/assinatura",
  ranking: "/conta/ranking",
};
const PATH_TO_SCREEN = Object.fromEntries(Object.entries(SCREEN_TO_PATH).map(([k, v]) => [v, k]));

export default function App() {
  // Remove a tela de carregamento estática (do layout.js) assim que o
  // app de verdade termina de montar — é o sinal de que já passamos do
  // momento "tela branca" que a demora de ~7s deixava aparecer.
  useEffect(() => {
    const el = document.getElementById("app-shell-loader");
    if (el) el.remove();
  }, []);

  const [screen, setScreen] = useState("landing");
  const [showGlobalLoginModal, setShowGlobalLoginModal] = useState(false);
  // Quando a pessoa já está logada e começa um roteiro novo, ela pula a
  // tela de Criar Conta — então a numeração dos passos precisa "adiantar"
  // 1 casa (Destino vira Passo 1 em vez de Passo 2, e por aí vai).
  const [stepOffset, setStepOffset] = useState(0);
  // Pra onde ir depois de logar: "destino" se a pessoa clicou em "Montar
  // minha viagem" (quer começar um roteiro novo), ou "roteiros" se clicou
  // em "Entrar" (só quer acessar a conta que já tem). Precisa ser guardado
  // no localStorage, não só em memória — o login com Google recarrega a
  // página inteira (sai do site, vai pro Google, volta), e qualquer coisa
  // guardada só em memória (como um useRef) se perderia nesse meio-tempo.
  const setPostLoginTarget = (target) => localStorage.setItem("tripsz_post_login_target", target);
  // Devolve null se não tiver nenhuma intenção salva — importante não
  // inventar um destino padrão aqui, senão qualquer aviso do Supabase de
  // que já existe uma sessão (o que acontece toda vez que a pessoa volta
  // ao site já logada, não só depois de um login de verdade) empurraria
  // ela pro questionário sem que ela tivesse pedido isso.
  const readAndClearPostLoginTarget = () => {
    const target = localStorage.getItem("tripsz_post_login_target");
    localStorage.removeItem("tripsz_post_login_target");
    return target;
  };
  const [answers, setAnswers] = useState({});
  // Trava que impede o efeito "tela → URL" de rodar antes do efeito de
  // restauração inicial ler a URL original — sem isso, a primeira
  // renderização (screen="landing" por padrão) reescreveria qualquer link
  // direto (ex: /roteiro/destino) para "/" antes de conseguirmos lê-lo.
  const [initialized, setInitialized] = useState(false);
  const [plan, setPlan] = useState(null); // plano real (jogos de verdade) da tela aberta
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const trip = useMemo(() => planToTrip(plan, answers.countries), [plan, answers.countries]);
  // Opções A / B / C montadas a partir dos jogos do plano (vale também pra roteiros já salvos).
  const options = useMemo(() => buildOptions(plan), [plan]);
  // A opção escolhida libera a contratação da consultoria.
  const [chosenOption, setChosenOption] = useState(null);
  // Voltando do Mercado Pago sem concluir o pagamento: "failed" ou "pending" (vem na URL do retorno).
  const [paymentNotice, setPaymentNotice] = useState(null);
  const restart = () => {
    setAnswers({});
    setPlan(null);
    setPlanError(null);
    setChosenOption(null);
    setScreen("landing");
    localStorage.removeItem("tripsz_state");
  };

  const handleLogout = async () => {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    restart();
  };

  // Sempre que o passo muda, atualiza a URL na barra do navegador (sem
  // recarregar a página) pra refletir onde a pessoa está na jornada.
  // Só faz isso depois que a restauração inicial (efeito abaixo) já leu
  // a URL original — ver comentário na declaração de `initialized`.
  useEffect(() => {
    if (!initialized) return;
    const path = SCREEN_TO_PATH[screen] || "/";
    if (window.location.pathname !== path) {
      window.history.pushState({ screen }, "", path);
    }
  }, [screen, initialized]);

  // Quando a pessoa usa o botão voltar/avançar do navegador, a URL muda
  // sozinha (o navegador cuida disso) — só precisamos escutar e refletir
  // isso de volta no estado do app.
  useEffect(() => {
    const handlePopState = () => {
      const matched = PATH_TO_SCREEN[window.location.pathname];
      if (matched) setScreen(matched);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Guarda o passo atual e as respostas no localStorage sempre que mudam.
  // É essencial porque o login com Google recarrega a página inteira (o
  // navegador sai do site, vai pro Google e volta), e sem isso a pessoa
  // perderia tudo que já tinha preenchido e voltaria pro início.
  useEffect(() => {
    if (screen !== "landing") {
      localStorage.setItem("tripsz_state", JSON.stringify({ screen, answers }));
    }
  }, [screen, answers]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Se a pessoa acabou de voltar do Mercado Pago com sucesso, leva pra lista
    // de roteiros (o pedido pago é marcado pelo webhook e o roteiro já está salvo lá).
    if (params.get("status") === "paid") {
      setScreen("roteiros");
      setInitialized(true);
      return;
    }
    const payStatus = params.get("status");
    if (window.location.pathname === "/checkout" && (payStatus === "failed" || payStatus === "pending")) setPaymentNotice(payStatus);

    // Restaura as respostas salvas (sempre — mesmo se a URL mandar num
    // passo diferente, a pessoa não pode perder o que já preencheu).
    const saved = localStorage.getItem("tripsz_state");
    let restoredScreen = null;
    if (saved) {
      try {
        const { screen: savedScreen, answers: savedAnswers } = JSON.parse(saved);
        setAnswers(savedAnswers || {});
        restoredScreen = savedScreen || null;
      } catch (e) {
        console.error("Não foi possível restaurar o progresso salvo:", e);
      }
    }

    // A URL manda mais que o localStorage: se a pessoa abriu um link
    // direto, favoritou uma etapa, ou deu F5, respeita a URL atual.
    // Só cai no passo salvo no localStorage se a URL não for reconhecida
    // (ex: a pessoa estava na home "/").
    const pathScreen = PATH_TO_SCREEN[window.location.pathname];
    setScreen(pathScreen || restoredScreen || "landing");
    setInitialized(true);

    // Detecta quando o login com Google (ou e-mail/senha) termina e uma
    // sessão passa a existir. Se a pessoa estava parada na tela de conta
    // esperando login, avança sozinho pro próximo passo do questionário.
    const supabase = supabaseBrowser();

    // App instalado na tela de início (iPhone/Android): abre sempre em "/", que é a
    // página inicial. Se a pessoa já tem sessão, leva direto pra Meus Roteiros em vez
    // de mostrar o "Entrar" de novo. No navegador comum a página inicial continua igual.
    const isInstalledApp = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    if (isInstalledApp && (pathScreen || restoredScreen || "landing") === "landing") {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session) setScreen((current) => (current === "landing" ? "roteiros" : current));
      });
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setAnswers((a) => ({ ...a, userId: session.user.id }));
        const target = readAndClearPostLoginTarget();
        if (target) setScreen((current) => (current === "account" || current === "landing" ? target : current));
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // Monta o roteiro com jogos REAIS (/api/trip/plan) e salva as respostas junto
  // com a "foto" desse roteiro (coluna plan) — assim, quando a pessoa reabre o
  // roteiro depois, ela vê o que foi gerado, e não um recálculo com jogos que
  // podem ter mudado. O roteiro continua gratuito e já nasce desbloqueado; o que
  // pode ser vendido à parte é a consultoria humana (ver handleHireConsultoria).
  // Devolve a próxima tela ("account" se não há sessão, senão "resultado").
  const handleSaveTrip = async () => {
    const supabase = supabaseBrowser();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return "account";

    setPlanError(null);
    let newPlan = null;
    try {
      newPlan = await fetchPlan(answers);
      setPlan(newPlan);
    } catch (e) {
      console.error("Erro ao montar o roteiro:", e.message);
      setPlan(null);
      setPlanError(e.message || "Não foi possível montar o roteiro agora.");
    }

    const row = {
      user_id: userId,
      countries: answers.countries,
      date_start: answers.dateStart,
      date_end: answers.dateEnd,
      flex_level: answers.flexLevel,
      adults: answers.adults,
      kids: answers.kids,
      budget: answers.budget,
      priority: answers.priority,
      pace: answers.pace,
      favorite_teams: answers.favoriteTeams || [],
    };
    const withPlan = newPlan ? { ...row, plan: slimPlan(newPlan), plan_generated_at: new Date().toISOString() } : row;
    let { data, error } = await supabase.from("trip_answers").insert(withPlan).select().single();
    if (error && newPlan && /plan/i.test(error.message || "")) {
      // A coluna `plan` ainda não existe no banco (migração não rodada): salva só as respostas.
      console.warn("Coluna plan ausente em trip_answers — rode supabase-migration-etapa3.sql. Salvando só as respostas.");
      ({ data, error } = await supabase.from("trip_answers").insert(row).select().single());
    }
    if (error) {
      console.error("Erro ao salvar respostas:", error.message);
      // Mesmo se salvar falhar, ainda mostramos o resultado — só não vai
      // aparecer em "Meus Roteiros" depois.
      return "resultado";
    }
    setAnswers((a) => ({ ...a, userId, tripAnswersId: data.id }));
    return "resultado";
  };

  // Guarda a foto num roteiro que já existe (ex.: roteiros antigos, criados antes da coluna plan).
  const persistPlan = async (id, p) => {
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.from("trip_answers").update({ plan: slimPlan(p), plan_generated_at: new Date().toISOString() }).eq("id", id);
      if (error) console.warn("Não foi possível guardar o roteiro:", error.message);
    } catch (e) {
      console.warn("Não foi possível guardar o roteiro:", e);
    }
  };

  // A pessoa escolheu a opção A, B ou C. Guarda no roteiro: é isso que libera a consultoria
  // (o servidor confere de novo em /api/checkout antes de gerar o pagamento).
  const handleChooseOption = async (key) => {
    setChosenOption(key);
    if (!answers.tripAnswersId) return;
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.from("trip_answers").update({ selected_option: key, selected_option_at: new Date().toISOString() }).eq("id", answers.tripAnswersId);
      if (error) console.warn("Não foi possível guardar a opção escolhida (rode a migração da Etapa 3b):", error.message);
    } catch (e) {
      console.warn("Não foi possível guardar a opção escolhida:", e);
    }
  };

  // Carrega o plano da tela aberta: primeiro a foto salva no banco; se não houver
  // (roteiro antigo, ou a pessoa recarregou a página), recalcula com os jogos reais.
  const loadPlan = async (isCancelled = () => false) => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      if (answers.tripAnswersId) {
        const supabase = supabaseBrowser();
        const { data } = await supabase.from("trip_answers").select("*").eq("id", answers.tripAnswersId).maybeSingle();
        if (data?.selected_option && !isCancelled()) setChosenOption(data.selected_option);
        if (data?.plan) {
          if (!isCancelled()) setPlan(data.plan);
          return;
        }
      }
      if (!answers.countries?.length) return;
      const fresh = await fetchPlan(answers);
      if (isCancelled()) return;
      setPlan(fresh);
      if (answers.tripAnswersId) persistPlan(answers.tripAnswersId, fresh);
    } catch (e) {
      if (!isCancelled()) setPlanError(e.message || "Não foi possível montar o roteiro agora.");
    } finally {
      setPlanLoading(false);
    }
  };

  // Ao abrir "resultado" ou "roteiro" sem plano em memória, busca. Não tenta de novo
  // sozinho se acabou de dar erro (a pessoa usa o botão "Tentar de novo").
  useEffect(() => {
    if (!initialized || plan || planError) return;
    if (screen !== "resultado" && screen !== "roteiro") return;
    let cancelled = false;
    loadPlan(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [screen, initialized, plan, answers.tripAnswersId]);

  // O aviso de pagamento só vale dentro do checkout. Só limpa depois que o app terminou de
  // inicializar: na primeira renderização a tela ainda é a inicial, e limpar antes apagaria o
  // aviso que acabou de ser lido da URL do retorno do Mercado Pago.
  useEffect(() => {
    if (initialized && screen !== "checkout") setPaymentNotice(null);
  }, [screen, initialized]);

  // Recarregou (ou voltou do Mercado Pago) direto no checkout: a opção escolhida só existia na
  // memória — busca a que ficou guardada no roteiro, pra o botão de contratar continuar valendo.
  useEffect(() => {
    if (!initialized || screen !== "checkout" || chosenOption || !answers.tripAnswersId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabaseBrowser().from("trip_answers").select("selected_option").eq("id", answers.tripAnswersId).maybeSingle();
      if (!cancelled && data?.selected_option) setChosenOption(data.selected_option);
    })();
    return () => {
      cancelled = true;
    };
  }, [screen, initialized, chosenOption, answers.tripAnswersId]);

  return (
    <div style={{ width: "100%", minHeight: "100vh" }}>
      <FontImports />
      {screen === "landing" && (
        <LandingPage
          onStart={async () => {
            const supabase = supabaseBrowser();
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setStepOffset(1);
              setScreen("destino");
            } else {
              setStepOffset(0);
              setPostLoginTarget("destino");
              setScreen("account");
            }
          }}
          onSubscribe={async () => {
            const supabase = supabaseBrowser();
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setScreen("assinar");
            } else {
              setPostLoginTarget("assinar");
              setScreen("criarconta");
            }
          }}
          onLogin={async () => {
            const supabase = supabaseBrowser();
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setScreen("roteiros");
              return;
            }
            setPostLoginTarget("roteiros");
            setShowGlobalLoginModal(true);
          }}
        />
      )}
      {screen === "criarconta" && (
        <CriarConta
          onDone={() => setScreen(readAndClearPostLoginTarget() || "roteiros")}
          onLogin={() => setShowGlobalLoginModal(true)}
          onHome={restart}
        />
      )}
      {screen === "assinar" && <AssinarStandalone onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "account" && <StepAccount answers={answers} setAnswers={setAnswers} onNext={() => setScreen(readAndClearPostLoginTarget() || "destino")} onBack={restart} />}
      {screen === "destino" && <StepDestino answers={answers} setAnswers={setAnswers} onNext={() => setScreen("times")} onBack={() => setScreen(stepOffset === 1 ? "roteiros" : "account")} onHome={restart} stepOffset={stepOffset} />}
      {screen === "times" && <StepTimesFavoritos answers={answers} setAnswers={setAnswers} onNext={() => setScreen("datas")} onBack={() => setScreen("destino")} onHome={restart} stepOffset={stepOffset} />}
      {screen === "datas" && <StepDatas answers={answers} setAnswers={setAnswers} onNext={() => setScreen("pessoas")} onBack={() => setScreen("times")} onHome={restart} stepOffset={stepOffset} />}
      {screen === "pessoas" && <StepPessoasOrcamento answers={answers} setAnswers={setAnswers} onNext={() => setScreen("preferencias")} onBack={() => setScreen("datas")} onHome={restart} stepOffset={stepOffset} />}
      {screen === "preferencias" && <StepPreferencias answers={answers} setAnswers={setAnswers} onNext={() => setScreen("loading")} onBack={() => setScreen("pessoas")} onHome={restart} stepOffset={stepOffset} />}
      {screen === "loading" && <LoadingScreen onWork={handleSaveTrip} onDone={(next) => setScreen(next || "resultado")} />}
      {screen === "resultado" && <ResultadoRoteiro trip={trip} options={options} chosenOption={chosenOption} onChooseOption={handleChooseOption} planLoading={planLoading} planError={planError} onRetryPlan={() => loadPlan()} onHireConsultoria={() => { if (chosenOption) setScreen("checkout"); }} onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "checkout" && <Checkout answers={answers} selectedOption={chosenOption} paymentNotice={paymentNotice} onBack={() => setScreen("resultado")} onDone={() => setScreen("roteiro")} onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "roteiro" && (
        <RoteiroDetalhe
          trip={trip}
          options={options}
          chosenOption={chosenOption}
          onChooseOption={handleChooseOption}
          planLoading={planLoading}
          planError={planError}
          onRetryPlan={() => loadPlan()}
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onBackToRoteiros={() => setScreen("roteiros")}
          onHireConsultoria={() => { if (chosenOption) setScreen("checkout"); }}
        />
      )}
      {screen === "roteiros" && (
        <MeusRoteiros
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onCreateNew={() => { setAnswers((a) => ({ userId: a.userId })); setPlan(null); setPlanError(null); setChosenOption(null); setStepOffset(1); setScreen("destino"); }}
          onOpenTrip={(tripAnswers, savedPlan, savedOption) => {
            setAnswers((a) => ({ ...a, ...tripAnswers }));
            setPlan(savedPlan || null);
            setPlanError(null);
            setChosenOption(savedOption || null);
            setScreen("roteiro");
          }}
          onEditTrip={(tripAnswers) => {
            setAnswers((a) => ({ ...a, ...tripAnswers }));
            setPlan(null);
            setPlanError(null);
            setChosenOption(null);
            setStepOffset(1);
            setScreen("destino");
          }}
        />
      )}
      {screen === "conquistas" && (
        <MinhasConquistas
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onCreateNew={() => { setAnswers((a) => ({ userId: a.userId })); setPlan(null); setPlanError(null); setChosenOption(null); setStepOffset(1); setScreen("destino"); }}
        />
      )}
      {screen === "jogos" && (
        <MeusJogosHistorico
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onRegisterNew={() => setScreen("registrar-jogo")}
        />
      )}
      {screen === "buscar" && <BuscarJogos onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "calendario" && <MeuCalendario onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "registrar-jogo" && (
        <RegistrarJogo
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onDone={() => setScreen("jogos")}
        />
      )}
      {screen === "nivel" && (
        <MeuNivel
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onCreateNew={() => { setAnswers((a) => ({ userId: a.userId })); setPlan(null); setPlanError(null); setChosenOption(null); setStepOffset(1); setScreen("destino"); }}
        />
      )}
      {screen === "perfil" && <MeuPerfil onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "assinatura" && <MinhaAssinatura onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "ranking" && <RankingTorcedores onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {showGlobalLoginModal && (
        <LoginModal
          onClose={() => setShowGlobalLoginModal(false)}
          onCreateAccount={() => { setShowGlobalLoginModal(false); setScreen("criarconta"); }}
        />
      )}
    </div>
  );
}
