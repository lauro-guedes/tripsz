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
      .select("stadium, country, competition")
      .eq("user_id", profile.user_id);
    const games = attended || [];

    const stadiums = new Set(games.map((g) => g.stadium).filter(Boolean));
    const countries = new Set(games.map((g) => g.country).filter(Boolean));
    const totalGames = games.length;
    const hasChampions = games.some((g) => /champions league/i.test(g.competition || ""));
    const completedBadges = [stadiums.size >= 5, countries.size >= 3, hasChampions].filter(Boolean).length;
    const xp = totalGames * 50 + stadiums.size * 100 + countries.size * 200 + completedBadges * 150;
    const tier = computeTier(xp);

    const badges = [
      stadiums.size >= 5 && "5 Estádios",
      stadiums.size >= 15 && "15 Estádios",
      stadiums.size >= 30 && "30 Estádios",
      countries.size >= 3 && "3 Países",
      countries.size >= 6 && "6 Países",
      countries.size >= 10 && "10 Países",
      totalGames >= 1 && "Primeiro Jogo",
      totalGames >= 5 && "5 Jogos",
      totalGames >= 10 && "10 Jogos",
      totalGames >= 25 && "25 Jogos",
      totalGames >= 50 && "50 Jogos",
      hasChampions && "Champions League",
      user.created_at && new Date(user.created_at) < PASSPORT_LAUNCH_DATE && "Membro Fundador",
    ].filter(Boolean);

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
      badges,
    });
  } catch (e) {
    console.error("Erro em /api/public-profile/[slug]:", e);
    return Response.json({ error: "Não foi possível carregar esse perfil." }, { status: 500 });
  }
}
