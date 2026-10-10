"use client";
import { RADIUS_OPTIONS, cityShortName, cityWithoutCountry, formatLongDate, kickoffParts, todayInSaoPaulo } from "../../lib/calendarUtils";
import { supabaseBrowser } from "../../lib/supabase";
import { teamLabel } from "../../lib/textUtils";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, GOLD_BG, GREEN, MUTED, TEXT } from "../../lib/tokens";
import TeamBadge from "../TeamBadge";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { Icon } from "../ui/Icon";
import { Loading } from "../ui/Loading";
import { useIsMobile } from "../ui/useIsMobile";
import { Calendar, Check, Info, MapPin, Plus } from "lucide-react";
import { useEffect, useState } from "react";

export const BASE_CITY_KEY = "tripsz_base_city";

export function BuscarJogos({ onNavigate, onLogout }) {
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
