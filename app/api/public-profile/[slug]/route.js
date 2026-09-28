import { supabaseAdmin } from "@/lib/supabase";

const PASSPORT_LAUNCH_DATE = new Date("2026-09-25T00:00:00Z");

const XP_TIERS = [
  { level: 1, name: "Torcedor de Sofá", min: 0, max: 99 },
  { level: 2, name: "Estreante", min: 100, max: 499 },
  { level: 3, name: "Groundhopper", min: 500, max: 1499 },
  { level: 4, name: "Veterano", min: 1500, max: 3999 },
  { level: 5, name: "Lenda", min: 4000, max: Infinity },
];

function computeTier(xp) {
  return XP_TIERS.find((t) => xp >= t.min && xp <= t.max) || XP_TIERS[0];
}

function hasCompetition(games, regex, country) {
  return games.some((g) => regex.test(g.competition || "") && (!country || g.country === country));
}

/**
 * GET /api/public-profile/[slug]
 *
 * Rota PÚBLICA de verdade — não exige login, é feita pra quem recebe um
 * link compartilhado conseguir ver o Football Passport de alguém. Só
 * devolve dados seguros de mostrar (nome, foto, nível, badges,
 * estatísticas) — nunca e-mail, WhatsApp, ou detalhes de viagem/roteiro.
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
      .select("stadium, country, competition, match_date, home_team, away_team")
      .eq("user_id", profile.user_id);
    const games = (attended || []).map((g) => ({ ...g, home: g.home_team, away: g.away_team }));

    const { data: trips } = await supabase
      .from("trip_answers")
      .select("favorite_teams")
      .eq("user_id", profile.user_id);
    const favoriteTeams = new Set((trips || []).flatMap((t) => t.favorite_teams || []));

    const stadiums = new Set(games.map((g) => g.stadium).filter(Boolean));
    const countries = new Set(games.map((g) => g.country).filter(Boolean));
    const competitions = new Set(games.map((g) => g.competition).filter(Boolean));
    const totalGames = games.length;

    const sortedDates = games.map((g) => g.match_date).filter(Boolean).sort();
    const firstGameDate = sortedDates[0] || null;

    const hasChampions = hasCompetition(games, /champions league/i);
    const hasFavoriteGame = games.some((g) => favoriteTeams.has(g.home) || favoriteTeams.has(g.away));
    const isLegacy = user.created_at && new Date(user.created_at) < PASSPORT_LAUNCH_DATE;
    const completedBadges = [stadiums.size >= 5, countries.size >= 3, hasChampions].filter(Boolean).length;
    const xp = totalGames * 50 + stadiums.size * 100 + countries.size * 200 + completedBadges * 150;
    const tier = computeTier(xp);

    // Mesma estrutura por categoria da tela "Minhas Conquistas" — só que
    // aqui a página pública só mostra as badges DESBLOQUEADAS.
    const badgeCategories = [
      {
        title: "Estádios & Geografia",
        badges: [
          { label: "5 Estádios", unlocked: stadiums.size >= 5 },
          { label: "15 Estádios", unlocked: stadiums.size >= 15 },
          { label: "30 Estádios", unlocked: stadiums.size >= 30 },
          { label: "3 Países", unlocked: countries.size >= 3 },
          { label: "6 Países", unlocked: countries.size >= 6 },
          { label: "10 Países", unlocked: countries.size >= 10 },
        ],
      },
      {
        title: "Competições",
        badges: [
          { label: "Champions League", unlocked: hasChampions },
          { label: "Premier League", unlocked: hasCompetition(games, /premier league/i) },
          { label: "La Liga", unlocked: hasCompetition(games, /la liga/i) },
          { label: "Serie A", unlocked: hasCompetition(games, /serie a/i, "Italy") },
          { label: "Bundesliga", unlocked: hasCompetition(games, /bundesliga/i) },
          { label: "Ligue 1", unlocked: hasCompetition(games, /ligue 1/i) },
          { label: "Brasileirão", unlocked: hasCompetition(games, /brasileir/i) },
          { label: "Libertadores", unlocked: hasCompetition(games, /libertadores/i) },
        ],
      },
      {
        title: "Marcos de Jornada",
        badges: [
          { label: "Primeiro Jogo", unlocked: totalGames >= 1, detail: firstGameDate },
          { label: "5 Jogos", unlocked: totalGames >= 5 },
          { label: "10 Jogos", unlocked: totalGames >= 10 },
          { label: "25 Jogos", unlocked: totalGames >= 25 },
          { label: "50 Jogos", unlocked: totalGames >= 50 },
        ],
      },
      {
        title: "Times Favoritos",
        badges: [{ label: "Torcedor Fiel", unlocked: hasFavoriteGame }],
      },
      {
        title: "Passport & Comunidade",
        badges: [{ label: "Membro Fundador", unlocked: isLegacy, detail: user.created_at }],
      },
    ]
      .map((cat) => ({ ...cat, badges: cat.badges.filter((b) => b.unlocked) }))
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
