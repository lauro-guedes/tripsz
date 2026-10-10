"use client";
import { authFetch } from "../../lib/authFetch";
import { TOURNAMENTS, hasMainTournament } from "../../lib/competitionBadges";
import { continentOf, countryKey, sameCountry } from "../../lib/countries";
import { dateOnly } from "../../lib/dateOnly";
import { PASSPORT_LAUNCH_DATE } from "../../lib/passportAccess";
import { supabaseBrowser } from "../../lib/supabase";
import { initials } from "../../lib/textUtils";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, GREEN, GREEN_BG, GREEN_BUTTON2, MUTED, TEXT } from "../../lib/tokens";
import { PHOTO_STADIUM } from "../landing/LandingPage";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { MESES_ABREV } from "../roteiro/RoteiroView";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { useIsMobile } from "../ui/useIsMobile";
import { TEAMS_BY_LEAGUE } from "../wizard/StepTimesFavoritos";
import { Award, Clipboard, Globe, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

/* --- Minhas Conquistas: Football Passport com estatísticas reais --- */
// Estádios icônicos reconhecidos pra badge "Colecionador de Templos" —
// lista curada, não exaustiva.
export const ICONIC_STADIUMS = [
  "maracanã", "anfield", "san siro", "giuseppe meazza", "camp nou",
  "santiago bernabéu", "old trafford", "allianz arena", "signal iduna park",
  "estádio cívitas metropolitano", "wanda metropolitano", "emirates stadium",
];

// Pares de clássicos/derbies conhecidos, pra badge "Clássico" — em
// qualquer ordem (casa x fora ou fora x casa).
export const KNOWN_DERBIES = [
  ["Flamengo", "Fluminense"], ["Corinthians", "Palmeiras"], ["Real Madrid", "Barcelona"],
  ["Inter", "Milan"], ["Boca Juniors", "River Plate"], ["Arsenal", "Tottenham"],
  ["Liverpool", "Everton"], ["Manchester City", "Manchester United"],
];

export function isDerby(home, away) {
  return KNOWN_DERBIES.some(([a, b]) => (home === a && away === b) || (home === b && away === a));
}

export const TIER_COLORS = { bronze: "#cd7f32", silver: "#c0c0c0", gold: "#ffd700" };

export function computeBadgeCategories(ctx) {
  if (!ctx) return [];
  const { allGames: games, stadiumsSet, countriesSet, favoriteTeamsSet, manualCount, apiCount, userCreatedAt, hasPublicProfile } = ctx;
  const totalGames = games.length;

  const hasCompetition = (regex, countryFilter) =>
    games.some((g) => regex.test(g.competition || "") && (!countryFilter || sameCountry(g.country, countryFilter)));

  const validDates = games.map((g) => new Date(g.date)).filter((d) => !isNaN(d));
  const firstGameDate = validDates.length ? new Date(Math.min(...validDates)) : null;

  const hasIconicStadium = games.some((g) => ICONIC_STADIUMS.some((s) => (g.stadium || "").toLowerCase().includes(s)));

  const hasEU = games.some((g) => continentOf(g.country) === "eu");
  const hasSA = games.some((g) => continentOf(g.country) === "sa");
  const hasDerby = games.some((g) => isDerby(g.home, g.away));

  const teamToLeague = {};
  TEAMS_BY_LEAGUE.forEach((g) => g.teams.forEach((t) => { teamToLeague[t] = g.league; }));
  const favoriteLeagues = new Set([...favoriteTeamsSet].map((t) => teamToLeague[t]).filter(Boolean));
  const hasFavoriteGame = games.some((g) => favoriteTeamsSet.has(g.home) || favoriteTeamsSet.has(g.away));

  // "Maratonista": jogos em 2+ países dentro de uma janela de 7 dias.
  const sorted = games.map((g) => ({ ...g, d: new Date(g.date) })).filter((g) => !isNaN(g.d)).sort((a, b) => a.d - b.d);
  let hasMarathon = false;
  for (let i = 0; i < sorted.length && !hasMarathon; i++) {
    const windowCountries = new Set();
    for (let j = i; j < sorted.length; j++) {
      if ((sorted[j].d - sorted[i].d) / 86400000 > 7) break;
      if (sorted[j].country) windowCountries.add(countryKey(sorted[j].country));
    }
    if (windowCountries.size >= 2) hasMarathon = true;
  }

  const hasWinterEU = games.some((g) => {
    const d = new Date(g.date);
    const m = d.getMonth() + 1;
    return continentOf(g.country) === "eu" && (m === 12 || m === 1 || m === 2);
  });
  const hasNewYear = games.some((g) => {
    const d = new Date(g.date);
    return (d.getMonth() === 11 && d.getDate() === 31) || (d.getMonth() === 0 && d.getDate() === 1);
  });

  const isLegacy = !!(userCreatedAt && userCreatedAt < PASSPORT_LAUNCH_DATE);
  const b = (unlocked, detail) => ({ unlocked, detail: detail || null });

  // Seleção Nacional — o nome do time bate com o de uma seleção (times
  // de país, não de clube).
  const NATIONAL_TEAM_NAMES = new Set([
    "Brazil", "Argentina", "England", "Spain", "Italy", "Germany", "France",
    "Portugal", "Netherlands", "Turkey", "Uruguay", "Chile", "Colombia",
    "USA", "Mexico", "Japan", "South Korea", "Morocco", "Croatia", "Serbia",
    "Poland", "Belgium", "Switzerland", "Austria", "Denmark", "Sweden",
    "Norway", "Egypt", "Russia", "Greece", "Scotland", "Ukraine",
  ]);
  const hasNationalTeamGame = games.some((g) => NATIONAL_TEAM_NAMES.has(g.home) || NATIONAL_TEAM_NAMES.has(g.away));

  // Rival Histórico — foi a um clássico envolvendo um dos times favoritos.
  const hasFavoriteDerby = games.some((g) => (favoriteTeamsSet.has(g.home) || favoriteTeamsSet.has(g.away)) && isDerby(g.home, g.away));

  // Coração Dividido — times favoritos de 2+ ligas diferentes (cada liga
  // doméstica é de um país só, então isso é um bom indício de torcida
  // em mais de um país).
  const hasDividedHeart = favoriteLeagues.size >= 2;

  // Veterano de Conta — conta criada há mais de 1 ano.
  const isVeteranAccount = !!(userCreatedAt && (Date.now() - userCreatedAt.getTime()) > 365 * 86400000);

  // Verão Sul-Americano — jogo na América do Sul entre dezembro e
  // fevereiro (é verão lá, oposto do Inverno Europeu).
  const hasSummerSA = games.some((g) => {
    const d = new Date(g.date);
    const m = d.getMonth() + 1;
    return continentOf(g.country) === "sa" && (m === 12 || m === 1 || m === 2);
  });

  // Ano de Copa — jogo (de qualquer competição) durante uma janela real
  // de Copa do Mundo. 2022 foi em nov-dez (por causa do calor no Catar);
  // 2026 é o padrão jun-jul.
  const WORLD_CUP_WINDOWS = [
    { start: new Date("2022-11-20"), end: new Date("2022-12-18") },
    { start: new Date("2026-06-11"), end: new Date("2026-07-19") },
  ];
  const hasWorldCupYear = games.some((g) => {
    const d = new Date(g.date);
    return WORLD_CUP_WINDOWS.some((w) => d >= w.start && d <= w.end);
  });

  return [
    {
      title: "Estádios & Geografia",
      badges: [
        { id: "est5", label: "5 Estádios", ...b(stadiumsSet.size >= 5) },
        { id: "est15", label: "15 Estádios", ...b(stadiumsSet.size >= 15) },
        { id: "est25", label: "25 Estádios", ...b(stadiumsSet.size >= 25) },
        { id: "est50", label: "50 Estádios", ...b(stadiumsSet.size >= 50) },
        { id: "est100", label: "100 Estádios", ...b(stadiumsSet.size >= 100) },
        { id: "pais3", label: "3 Países", ...b(countriesSet.size >= 3) },
        { id: "pais5", label: "5 Países", ...b(countriesSet.size >= 5) },
        { id: "pais10", label: "10 Países", ...b(countriesSet.size >= 10) },
        { id: "continentes2", label: "2 Continentes", ...b(hasEU && hasSA) },
        // "5 Continentes" fica sempre bloqueada por enquanto — hoje o
        // app só cobre 13 países em 2 continentes (Europa e América do
        // Sul), então não tem como isso ser desbloqueado de verdade
        // ainda. Mantemos o card pra bater com o design, mas sem
        // fingir que é alcançável.
        { id: "continentes5", label: "5 Continentes", ...b(false) },
      ],
    },
    {
      title: "Competições",
      badges: [
        { id: "champions", label: "Champions League", ...b(games.some((g) => g.competition === "champions") || hasCompetition(/champions league/i)) },
        { id: "worldcup", label: "Copa do Mundo", ...b(hasMainTournament(games, "worldcup")) },
        { id: "premier", label: "Premier League", ...b(hasCompetition(/premier league/i)) },
        { id: "laliga", label: "La Liga", ...b(hasCompetition(/la liga/i)) },
        { id: "seriea", label: "Serie A", ...b(hasCompetition(/serie a/i, "Italy")) },
        { id: "bundesliga", label: "Bundesliga", ...b(hasCompetition(/bundesliga/i)) },
        { id: "ligue1", label: "Ligue 1", ...b(hasCompetition(/ligue 1/i)) },
        { id: "brasileirao", label: "Brasileirão", ...b(hasCompetition(/brasileir/i) || hasCompetition(/serie a/i, "Brazil")) },
        { id: "libertadores", label: "Libertadores", ...b(hasCompetition(/libertadores/i)) },
        { id: "mundialclubes", label: "Mundial de Clubes", ...b(hasCompetition(/club world cup|mundial de clubes/i)) },
        ...TOURNAMENTS.filter((t) => t.id !== "worldcup").map((t) => ({ id: t.id, label: t.label, ...b(hasMainTournament(games, t.id)) })),
        { id: "classico", label: "Clássico", ...b(hasDerby) },
      ],
    },
    {
      title: "Marcos de Jornada",
      badges: [
        { id: "primeiro", label: "Primeiro Jogo", ...b(totalGames >= 1, firstGameDate) },
        { id: "jogos5", label: "5 Jogos", ...b(totalGames >= 5) },
        { id: "jogos10", label: "10 Jogos", ...b(totalGames >= 10) },
        { id: "jogos25", label: "25 Jogos", ...b(totalGames >= 25) },
        { id: "jogos50", label: "50 Jogos", ...b(totalGames >= 50) },
        { id: "jogos100", label: "100 Jogos", ...b(totalGames >= 100) },
        { id: "jogos150", label: "150 Jogos", ...b(totalGames >= 150) },
        { id: "jogos200", label: "200 Jogos", ...b(totalGames >= 200) },
        { id: "jogos250", label: "250 Jogos", ...b(totalGames >= 250) },
        { id: "jogos500", label: "500 Jogos", ...b(totalGames >= 500) },
        { id: "maratonista", label: "Maratonista", ...b(hasMarathon) },
      ],
    },
    {
      title: "Times Favoritos",
      badges: [
        { id: "torcedorfiel", label: "Torcedor Fiel", ...b(hasFavoriteGame) },
        { id: "selecaonacional", label: "Seleção Nacional", ...b(hasNationalTeamGame) },
        { id: "multitorcida", label: "Multi-Torcida", ...b(favoriteLeagues.size >= 3) },
        { id: "rivalhistorico", label: "Rival Histórico", ...b(hasFavoriteDerby) },
        { id: "coracaodividido", label: "Coração Dividido", ...b(hasDividedHeart) },
      ],
    },
    {
      title: "Passport & Comunidade",
      badges: [
        { id: "fundador", label: "Membro Fundador", ...b(isLegacy, userCreatedAt) },
        { id: "detetive", label: "Detetive de Campo", ...b(manualCount >= 1) },
        { id: "perfilcompartilhado", label: "Perfil Compartilhado", ...b(!!hasPublicProfile) },
        { id: "assinante", label: "Assinante", ...b(!!ctx.isSubscriber) },
        { id: "verificado", label: "Verificado", ...b(apiCount >= 10) },
        { id: "veteranoconta", label: "Veterano de Conta", ...b(isVeteranAccount) },
      ],
    },
    {
      title: "Sazonais",
      badges: [
        { id: "invernoeuropeu", label: "Inverno Europeu", ...b(hasWinterEU) },
        { id: "reveillon", label: "Réveillon do Futebol", ...b(hasNewYear) },
        { id: "veraosulamericano", label: "Verão Sul-Americano", ...b(hasSummerSA) },
        { id: "anodecopa", label: "Ano de Copa", ...b(hasWorldCupYear) },
      ],
    },
  ];
}

export function MinhasConquistas({ onNavigate, onLogout, onCreateNew }) {
  const isMobile = useIsMobile();
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [userId, setUserId] = useState("");
  const [stats, setStats] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [attendedGames, setAttendedGames] = useState([]);
  const [showAddGame, setShowAddGame] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [loadingShareLink, setLoadingShareLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGetShareLink = async () => {
    setLoadingShareLink(true);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const res = await authFetch("/api/profile/get-or-create-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userData.user?.id, name: userData.user?.user_metadata?.name }),
      });
      const data = await res.json();
      if (res.ok) setShareLink(`${window.location.origin}/u/${data.slug}`);
    } catch {
      // silencioso — não é uma ação crítica, a pessoa pode tentar de novo
    } finally {
      setLoadingShareLink(false);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const looksLikeChampions = (name) => /champions league/i.test(name || "");

  const loadData = async () => {
    const supabase = supabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setUserName(user?.user_metadata?.name || user?.email || "");
    setUserAvatar(user?.user_metadata?.avatar_url || null);
    setUserId(user?.id || "");

    const { data: rows } = await supabase.from("trip_answers").select("*, orders(status)");
    const trips = rows || [];

    // Só contam pra estatística os roteiros de fato pagos/desbloqueados —
    // um rascunho não gerado ainda não é uma "conquista".
    const unlocked = trips.filter((r) => r.orders?.some((o) => o.status === "paid"));
    const source = unlocked.length ? unlocked : trips; // fallback pra não ficar tudo zerado em conta nova

    // Assinante — precisa ser uma assinatura de verdade (paga), não
    // só acesso de graça por ser conta legada.
    const { data: activeSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("status", "active")
      .maybeSingle();
    const isSubscriber = !!activeSub;

    const { data: attendedRows } = await supabase
      .from("attended_games")
      .select("*")
      .order("match_date", { ascending: false });
    const attended = attendedRows || [];
    setAttendedGames(attended);

    // Só jogos REGISTRADOS de verdade contam pras conquistas — gerar um
    // roteiro sugerido é só uma sugestão de viagem, não uma confirmação
    // de que a pessoa foi ao jogo.
    const allGames = attended.map((g) => ({ date: dateOnly(g.match_date), stadium: g.stadium, city: g.city, country: g.country, competition: g.competition, home: g.home_team, away: g.away_team, source: g.source }));

    const stadiums = new Set(allGames.map((g) => g.stadium).filter(Boolean));
    const countries = new Set(allGames.map((g) => countryKey(g.country)).filter(Boolean));
    const competitions = new Set(allGames.map((g) => g.competition || "domestica"));
    const hasChampions = allGames.some((g) => looksLikeChampions(g.competition));

    // Times favoritos declarados de verdade em Meu Perfil — campo
    // estável, não muda a cada roteiro que a pessoa preenche.
    const favoriteTeams = new Set(user?.user_metadata?.favorite_teams || []);

    // Perfil Compartilhado — a pessoa já gerou o link do Football
    // Passport público (tabela public_profiles).
    const { data: publicProfileRow } = await supabase
      .from("public_profiles")
      .select("slug")
      .eq("user_id", user?.id)
      .maybeSingle();
    if (publicProfileRow?.slug) setShareLink(`${window.location.origin}/u/${publicProfileRow.slug}`);

    setStats({
      stadiums: stadiums.size,
      countries: countries.size,
      games: allGames.length,
      competitions: competitions.size,
      hasChampions,
      tripsCount: source.length,
    });

    setCtx({
      allGames,
      stadiumsSet: stadiums,
      countriesSet: countries,
      favoriteTeamsSet: favoriteTeams,
      hasPublicProfile: !!publicProfileRow,
      isSubscriber,
      manualCount: attended.filter((g) => g.source === "manual").length,
      apiCount: attended.filter((g) => g.source === "api").length,
      userCreatedAt: user?.created_at ? new Date(user.created_at) : null,
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteAttended = async (id) => {
    if (!window.confirm("Remover este jogo da sua lista de conquistas?")) return;
    const supabase = supabaseBrowser();
    await supabase.from("attended_games").delete().eq("id", id);
    loadData();
  };

  const px = isMobile ? "16px" : "80px";
  const level = stats && stats.countries >= 5 ? "VIP GROUNDHOPPER" : stats && stats.countries >= 1 ? "GROUNDHOPPER" : "NOVATO";

  const fmtDate = (d) => {
    if (!d) return null;
    const dd = new Date(d);
    if (isNaN(dd)) return null;
    return `${String(dd.getDate()).padStart(2, "0")} ${MESES_ABREV[dd.getMonth()].charAt(0) + MESES_ABREV[dd.getMonth()].slice(1).toLowerCase()} ${dd.getFullYear()}`;
  };

  const badgeCategories = computeBadgeCategories(ctx);

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="conquistas" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ position: "relative", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 64, alignItems: "center", flexWrap: "wrap", padding: isMobile ? `32px ${px}` : `80px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <div style={{ position: "relative", flex: isMobile ? 1 : "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <Badge>Documento Oficial do Torcedor</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 56, lineHeight: 1.05, color: TEXT, margin: 0 }}>Seu Football Passport</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 22, lineHeight: 1.5, color: BODY, margin: 0 }}>Toda atmosfera vivida, cada arquibancada tremendo e os templos do futebol mundial que você já conquistou. Colecione conquistas de suas viagens.</p>
          <div><Button onClick={onCreateNew}>Montar Outra Viagem</Button></div>
        </div>
        <div style={{ position: "relative", background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 16, padding: 32, width: isMobile ? "100%" : 420, maxWidth: "100%", flexShrink: 0, display: "flex", flexDirection: "column", gap: 24, boxShadow: "0px 12px 24px rgba(0,200,83,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>FOOTBALL PASSPORT</p>
            <Icon name="shieldCheck" size={24} color={GREEN} />
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ width: 80, height: 100, borderRadius: 8, border: `1px solid ${BORDER}`, background: GREEN_BUTTON2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
              {userAvatar ? (
                <img src={userAvatar} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: "#fff", margin: 0 }}>{initials(userName)}</p>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nome do Titular</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{userName || "—"}</p>
              </div>
              <div>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nível de Acesso</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>{level}</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>ID: #{userId ? userId.slice(0, 4).toUpperCase() : "----"}-MD</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>ATIVAÇÃO: {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: "0px 8px 12px rgba(15,23,42,0.07)", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 24, padding: isMobile ? 20 : "16px 24px", margin: isMobile ? `0 ${px}` : `0 80px` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: isMobile ? "none" : "0 0 320px" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Perfil público</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: BODY, margin: 0 }}>Reúna jogos, estádios e conquistas em uma página compartilhável para amigos.</p>
        </div>
        <div style={{ background: BG, display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", flex: 1, minWidth: 0 }}>
          <Globe size={16} color={MUTED} style={{ flexShrink: 0 }} />
          <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTED, margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {shareLink ? shareLink.replace(/^https?:\/\//, "") : "Gere seu link abaixo para ver aqui"}
          </p>
          {shareLink && (
            <div onClick={handleCopyShareLink} style={{ cursor: "pointer", flexShrink: 0, display: "flex" }} title="Copiar link">
              <Clipboard size={16} color={copied ? GREEN : MUTED} />
            </div>
          )}
        </div>
        {!shareLink && (
          <div onClick={loadingShareLink ? undefined : handleGetShareLink} style={{ background: GREEN, padding: "10px 20px", borderRadius: 8, textAlign: "center", cursor: loadingShareLink ? "default" : "pointer", flexShrink: 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", margin: 0, whiteSpace: "nowrap" }}>{loadingShareLink ? "Gerando..." : "Gerar perfil público"}</p>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", padding: isMobile ? `24px ${px}` : `48px ${px}` }}>
        {[["stadiums", "Estádios Visitados"], ["countries", "Países Conquistados"], ["games", "Jogos Assistidos"], ["competitions", "Competições Diferentes"]].map(([key, label]) => (
          <div key={key} style={{ flex: isMobile ? "1 0 45%" : 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: isMobile ? 16 : 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 40, color: GREEN, margin: 0 }}>{stats ? stats[key] : "—"}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, textTransform: "uppercase", textAlign: "center", margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ background: BG_ALT, padding: isMobile ? `32px ${px}` : `80px ${px}`, display: "flex", flexDirection: "column", gap: 24 }}>
        <Badge gold>Football Passport</Badge>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 22 : 32, color: TEXT, margin: 0 }}>Conquistas de Viagem</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {badgeCategories.map((cat) => (
            <div key={cat.title} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ background: GREEN, width: 4, height: 32, borderRadius: 2 }} />
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: TEXT, textTransform: "uppercase", margin: 0 }}>{cat.title}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 16 }}>
                {cat.badges.map((bdg) => {
                  const dateLabel = bdg.unlocked ? (fmtDate(bdg.detail) || "Desbloqueado") : "Bloqueado";
                  // Mesmo ícone que o Figma usa por categoria: Globe pra
                  // país/continente, estádio de verdade (ícone próprio)
                  // pros estádios, Trophy pra competição, Award pro resto.
                  const isStadiumBadge = cat.title === "Estádios & Geografia" && !/país|continente/i.test(bdg.label);
                  let BadgeIcon = Award;
                  if (cat.title === "Estádios & Geografia") {
                    BadgeIcon = Globe;
                  } else if (cat.title === "Competições") {
                    BadgeIcon = Trophy;
                  }
                  return (
                    <div key={bdg.id} style={{ background: "#fff", border: `1.5px solid ${bdg.unlocked ? GREEN : BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16, minHeight: 160, opacity: bdg.unlocked ? 1 : 0.6 }}>
                      <div style={{ background: bdg.unlocked ? GREEN_BG : BG_ALT, width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isStadiumBadge ? <Icon name="stadium" size={20} color={bdg.unlocked ? GREEN : MUTED} /> : <BadgeIcon size={20} color={bdg.unlocked ? GREEN : MUTED} />}
                      </div>
                      <div>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: bdg.unlocked ? TEXT : MUTED, margin: 0 }}>{bdg.label}</p>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: bdg.unlocked ? GREEN : MUTED, textTransform: "uppercase", margin: 0 }}>{dateLabel}</p>
                      </div>
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
