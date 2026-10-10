"use client";
import { authFetch } from "../../lib/authFetch";
import { guessCountryFromCompetition, parseFutbologyLine } from "../../lib/futbologyParse";
import { checkPassportAccess } from "../../lib/passportAccess";
import { parseSeasonValue, seasonOptionGroups } from "../../lib/seasons";
import { supabaseBrowser } from "../../lib/supabase";
import { teamLabel } from "../../lib/textUtils";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BG, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import TeamBadge from "../TeamBadge";
import { PassportPaywall } from "../conta/PassportPaywall";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { Icon } from "../ui/Icon";
import { Loading } from "../ui/Loading";
import { useIsMobile } from "../ui/useIsMobile";
import { Check, Download, Lock } from "lucide-react";
import { useEffect, useState } from "react";

/* --- Registrar Jogo: fluxo guiado, busca por estádio na API-Football --- */
export function RegistrarJogo({ onNavigate, onLogout, onDone }) {
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
