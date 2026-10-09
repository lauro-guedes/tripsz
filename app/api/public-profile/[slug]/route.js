import { supabaseAdmin } from "@/lib/supabase";
import { TOURNAMENTS, hasMainTournament } from "@/lib/competitionBadges";
import { countryKey, continentOf, sameCountry } from "@/lib/countries";

// Essa rota SEMPRE precisa rodar de verdade (consulta o banco a cada
// chamada) — sem isso, o Next.js tenta "pré-analisar" ela durante o
// build (por causa do parâmetro dinâmico [slug]) e quebra.
export const dynamic = "force-dynamic";

const PASSPORT_LAUNCH_DATE = new Date("2026-09-25T00:00:00Z");

const XP_TIERS = [
  { level: 1, name: "Torcedor de Sofá", min: 0, max: 499 },
  { level: 2, name: "Estreante", min: 500, max: 1499 },
  { level: 3, name: "Groundhopper", min: 1500, max: 4999 },
  { level: 4, name: "Veterano", min: 5000, max: 19999 },
  { level: 5, name: "Lenda", min: 20000, max: Infinity },
];

function computeTier(xp) {
  return XP_TIERS.find((t) => xp >= t.min && xp <= t.max) || XP_TIERS[0];
}

function hasCompetitionFn(games, regex, country) {
  return games.some((g) => regex.test(g.competition || "") && (!country || sameCountry(g.country, country)));
}

const NATIONAL_TEAM_NAMES = new Set([
  "Brazil", "Argentina", "England", "Spain", "Italy", "Germany", "France",
  "Portugal", "Netherlands", "Turkey", "Uruguay", "Chile", "Colombia",
  "USA", "Mexico", "Japan", "South Korea", "Morocco", "Croatia", "Serbia",
  "Poland", "Belgium", "Switzerland", "Austria", "Denmark", "Sweden",
  "Norway", "Egypt", "Russia", "Greece", "Scotland", "Ukraine",
]);

const KNOWN_DERBIES = [
  ["Flamengo", "Fluminense"], ["Corinthians", "Palmeiras"], ["Boca Juniors", "River Plate"],
  ["Barcelona", "Real Madrid"], ["Liverpool", "Everton"], ["Arsenal", "Tottenham"],
  ["Inter", "Milan"], ["Internazionale", "Milan"], ["Roma", "Lazio"],
  ["Manchester United", "Manchester City"], ["Grêmio", "Internacional"],
];
function isDerby(home, away) {
  return KNOWN_DERBIES.some(([a, b]) => (home === a && away === b) || (home === b && away === a));
}


const WORLD_CUP_WINDOWS = [
  { start: new Date("2022-11-20"), end: new Date("2022-12-18") },
  { start: new Date("2026-06-11"), end: new Date("2026-07-19") },
];

/**
 * GET /api/public-profile/[slug]
 *
 * Rota PÚBLICA de verdade — não exige login, é feita pra quem recebe um
 * link compartilhado conseguir ver o Football Passport de alguém. Só
 * devolve dados seguros de mostrar (nome, foto, nível, badges,
 * estatísticas) — nunca e-mail, WhatsApp, ou detalhes de viagem/roteiro.
 *
 * Mesma fórmula e mesma lista de badges usada em "Minhas Conquistas" —
 * sempre que uma mudar, a outra precisa mudar junto.
 */
export async function GET(request, { params }) {
  const { slug } = params;

  try {
    const supabase = supabaseAdmin();

    const { data: profile } = await supabase
      .from("public_profiles")
      .select("user_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!profile) {
      return Response.json({ found: false }, { status: 404 });
    }

    const { data: userRow } = await supabase.auth.admin.getUserById(profile.user_id);
    const user = userRow?.user;
    if (!user) {
      return Response.json({ found: false }, { status: 404 });
    }

    const { data: attended } = await supabase
      .from("attended_games")
      .select("stadium, country, competition, match_date, home_team, away_team, source")
      .eq("user_id", profile.user_id);
    const games = (attended || []).map((g) => ({ ...g, home: g.home_team, away: g.away_team }));
    const manualCount = games.filter((g) => g.source === "manual").length;
    const apiCount = games.filter((g) => g.source === "api").length;

    // Times favoritos: campo estável do perfil (não mais do roteiro).
    const favoriteTeams = new Set(user.user_metadata?.favorite_teams || []);
    const favoriteLeaguesCount = favoriteTeams.size; // aproximação razoável sem acesso à mesma tabela de ligas do app

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", profile.user_id)
      .eq("status", "active")
      .maybeSingle();
    const isSubscriber = !!sub;

    const stadiums = new Set(games.map((g) => g.stadium).filter(Boolean));
    const countries = new Set(games.map((g) => countryKey(g.country)).filter(Boolean));
    const competitions = new Set(games.map((g) => g.competition).filter(Boolean));
    const totalGames = games.length;

    const sortedDates = games.map((g) => g.match_date).filter(Boolean).sort();
    const firstGameDate = sortedDates[0] || null;

    const hasChampions = hasCompetitionFn(games, /champions league/i);
    const hasFavoriteGame = games.some((g) => favoriteTeams.has(g.home) || favoriteTeams.has(g.away));
    const hasFavoriteDerby = games.some((g) => (favoriteTeams.has(g.home) || favoriteTeams.has(g.away)) && isDerby(g.home, g.away));
    const hasNationalTeamGame = games.some((g) => NATIONAL_TEAM_NAMES.has(g.home) || NATIONAL_TEAM_NAMES.has(g.away));
    const hasDerby = games.some((g) => isDerby(g.home, g.away));
    const hasEU = games.some((g) => continentOf(g.country) === "eu");
    const hasSA = games.some((g) => continentOf(g.country) === "sa");
    const hasWinterEU = games.some((g) => {
      const d = new Date(g.match_date);
      const m = d.getMonth() + 1;
      return continentOf(g.country) === "eu" && (m === 12 || m === 1 || m === 2);
    });
    const hasSummerSA = games.some((g) => {
      const d = new Date(g.match_date);
      const m = d.getMonth() + 1;
      return continentOf(g.country) === "sa" && (m === 12 || m === 1 || m === 2);
    });
    const hasNewYear = games.some((g) => {
      const d = new Date(g.match_date);
      return (d.getMonth() === 11 && d.getDate() === 31) || (d.getMonth() === 0 && d.getDate() === 1);
    });
    const hasWorldCupYear = games.some((g) => {
      const d = new Date(g.match_date);
      return WORLD_CUP_WINDOWS.some((w) => d >= w.start && d <= w.end);
    });
    const hasMarathon = (() => {
      const dates = games.map((g) => new Date(g.match_date)).filter((d) => !isNaN(d)).sort((a, b) => a - b);
      for (let i = 0; i < dates.length; i++) {
        let count = 1;
        for (let j = i + 1; j < dates.length; j++) {
          if ((dates[j] - dates[i]) / 86400000 <= 7) count++;
          else break;
        }
        if (count >= 3) return true;
      }
      return false;
    })();

    const isLegacy = user.created_at && new Date(user.created_at) < PASSPORT_LAUNCH_DATE;
    const isVeteranAccount = user.created_at && (Date.now() - new Date(user.created_at).getTime()) > 365 * 86400000;

    const completedBadges = [stadiums.size >= 5, countries.size >= 3, hasChampions].filter(Boolean).length;
    const xp = totalGames * 50 + stadiums.size * 100 + countries.size * 200 + completedBadges * 150;
    const tier = computeTier(xp);

    const b = (unlocked, detail) => ({ unlocked, detail: detail || null });

    // Mesma estrutura, mesmos limites e as mesmas badges novas de
    // "Minhas Conquistas" — só mostra aqui as já desbloqueadas.
    const badgeCategories = [
      {
        title: "Estádios & Geografia",
        badges: [
          { label: "5 Estádios", ...b(stadiums.size >= 5) },
          { label: "15 Estádios", ...b(stadiums.size >= 15) },
          { label: "25 Estádios", ...b(stadiums.size >= 25) },
          { label: "50 Estádios", ...b(stadiums.size >= 50) },
          { label: "100 Estádios", ...b(stadiums.size >= 100) },
          { label: "3 Países", ...b(countries.size >= 3) },
          { label: "5 Países", ...b(countries.size >= 5) },
          { label: "10 Países", ...b(countries.size >= 10) },
          { label: "2 Continentes", ...b(hasEU && hasSA) },
          { label: "5 Continentes", ...b(false) },
        ],
      },
      {
        title: "Competições",
        badges: [
          { label: "Champions League", ...b(hasChampions) },
          { label: "Copa do Mundo", ...b(hasMainTournament(games, "worldcup")) },
          { label: "Premier League", ...b(hasCompetitionFn(games, /premier league/i)) },
          { label: "La Liga", ...b(hasCompetitionFn(games, /la liga/i)) },
          { label: "Serie A", ...b(hasCompetitionFn(games, /serie a/i, "Italy")) },
          { label: "Bundesliga", ...b(hasCompetitionFn(games, /bundesliga/i)) },
          { label: "Ligue 1", ...b(hasCompetitionFn(games, /ligue 1/i)) },
          { label: "Brasileirão", ...b(hasCompetitionFn(games, /brasileir/i) || hasCompetitionFn(games, /serie a/i, "Brazil")) },
          { label: "Libertadores", ...b(hasCompetitionFn(games, /libertadores/i)) },
          { label: "Mundial de Clubes", ...b(hasCompetitionFn(games, /club world cup|mundial de clubes/i)) },
          ...TOURNAMENTS.filter((t) => t.id !== "worldcup").map((t) => ({ label: t.label, ...b(hasMainTournament(games, t.id)) })),
          { label: "Clássico", ...b(hasDerby) },
        ],
      },
      {
        title: "Marcos de Jornada",
        badges: [
          { label: "Primeiro Jogo", ...b(totalGames >= 1, firstGameDate) },
          { label: "5 Jogos", ...b(totalGames >= 5) },
          { label: "10 Jogos", ...b(totalGames >= 10) },
          { label: "25 Jogos", ...b(totalGames >= 25) },
          { label: "50 Jogos", ...b(totalGames >= 50) },
          { label: "100 Jogos", ...b(totalGames >= 100) },
          { label: "150 Jogos", ...b(totalGames >= 150) },
          { label: "200 Jogos", ...b(totalGames >= 200) },
          { label: "250 Jogos", ...b(totalGames >= 250) },
          { label: "500 Jogos", ...b(totalGames >= 500) },
          { label: "Maratonista", ...b(hasMarathon) },
        ],
      },
      {
        title: "Times Favoritos",
        badges: [
          { label: "Torcedor Fiel", ...b(hasFavoriteGame) },
          { label: "Seleção Nacional", ...b(hasNationalTeamGame) },
          { label: "Multi-Torcida", ...b(favoriteLeaguesCount >= 3) },
          { label: "Rival Histórico", ...b(hasFavoriteDerby) },
          { label: "Coração Dividido", ...b(favoriteLeaguesCount >= 2) },
        ],
      },
      {
        title: "Passport & Comunidade",
        badges: [
          { label: "Membro Fundador", ...b(isLegacy, user.created_at) },
          { label: "Detetive de Campo", ...b(manualCount >= 1) },
          { label: "Perfil Compartilhado", ...b(true) }, // chegar nessa página já prova que o perfil foi gerado e compartilhado
          { label: "Assinante", ...b(isSubscriber) },
          { label: "Verificado", ...b(apiCount >= 10) },
          { label: "Veterano de Conta", ...b(isVeteranAccount) },
        ],
      },
      {
        title: "Sazonais",
        badges: [
          { label: "Inverno Europeu", ...b(hasWinterEU) },
          { label: "Réveillon do Futebol", ...b(hasNewYear) },
          { label: "Verão Sul-Americano", ...b(hasSummerSA) },
          { label: "Ano de Copa", ...b(hasWorldCupYear) },
        ],
      },
    ]
      .map((cat) => ({ ...cat, badges: cat.badges.filter((bd) => bd.unlocked) }))
      .filter((cat) => cat.badges.length > 0);

    return Response.json({
      found: true,
      name: user.user_metadata?.name || "Torcedor tripsz",
      avatarUrl: user.user_metadata?.avatar_url || null,
      level: tier.level,
      levelName: tier.name,
      xp,
      stadiums: stadiums.size,
      countries: countries.size,
      games: totalGames,
      competitions: competitions.size,
      activationYear: user.created_at ? new Date(user.created_at).getFullYear() : new Date().getFullYear(),
      shortId: profile.user_id.replace(/-/g, "").slice(0, 4).toUpperCase() + "-" + profile.user_id.replace(/-/g, "").slice(4, 6).toUpperCase(),
      badgeCategories,
    });
  } catch (e) {
    console.error("Erro em /api/public-profile/[slug]:", e);
    return Response.json({ error: "Não foi possível carregar esse perfil." }, { status: 500 });
  }
}
