import { supabaseAdmin } from "@/lib/supabase";

const XP_TIERS = [
  { level: 1, name: "Torcedor de Sofá" },
  { level: 2, name: "Estreante" },
  { level: 3, name: "Groundhopper" },
  { level: 4, name: "Explorador" }, // nomeação usada no ranking (Figma) pra quem já tem alguma badge
  { level: 5, name: "Veterano" },
  { level: 6, name: "Lenda" },
];

// Faixas de XP pro nome exibido no ranking (bate com o que já usamos em
// Meu Nível, só que aqui reaproveitamos o nome "Explorador"/"Veterano"
// como o próprio design do ranking pede).
function tierName(xp) {
  if (xp >= 4000) return "Lenda";
  if (xp >= 1500) return "Veterano";
  if (xp >= 500) return "Explorador";
  if (xp >= 100) return "Estreante";
  return "Torcedor de Sofá";
}

const COUNTRY_FLAGS = {
  Brasil: "🇧🇷", Alemanha: "🇩🇪", Angola: "🇦🇴", Argentina: "🇦🇷", Austrália: "🇦🇺", Áustria: "🇦🇹",
  Bélgica: "🇧🇪", Bolívia: "🇧🇴", Canadá: "🇨🇦", Chile: "🇨🇱", China: "🇨🇳", Colômbia: "🇨🇴",
  "Coreia do Sul": "🇰🇷", "Costa Rica": "🇨🇷", Croácia: "🇭🇷", Cuba: "🇨🇺", Dinamarca: "🇩🇰",
  Egito: "🇪🇬", Equador: "🇪🇨", Escócia: "🇬🇧", Espanha: "🇪🇸", "Estados Unidos": "🇺🇸",
  França: "🇫🇷", Grécia: "🇬🇷", Holanda: "🇳🇱", Hungria: "🇭🇺", Índia: "🇮🇳", Inglaterra: "🇬🇧",
  Irlanda: "🇮🇪", Islândia: "🇮🇸", Itália: "🇮🇹", Japão: "🇯🇵", México: "🇲🇽", Marrocos: "🇲🇦",
  Moçambique: "🇲🇿", Noruega: "🇳🇴", "Nova Zelândia": "🇳🇿", Panamá: "🇵🇦", Paraguai: "🇵🇾",
  Peru: "🇵🇪", Polônia: "🇵🇱", Portugal: "🇵🇹", "Reino Unido": "🇬🇧", "República Tcheca": "🇨🇿",
  Rússia: "🇷🇺", Senegal: "🇸🇳", Sérvia: "🇷🇸", Suécia: "🇸🇪", Suíça: "🇨🇭", Turquia: "🇹🇷",
  Ucrânia: "🇺🇦", Uruguai: "🇺🇾", Venezuela: "🇻🇪",
};

/**
 * GET /api/ranking?userId=UUID&scope=nacional|global
 *
 * Calcula o XP de TODOS os usuários (só jogos registrados de verdade
 * contam, igual em Meu Nível) e monta o ranking. Só dá pra fazer isso
 * com a chave de serviço (ignora as regras de "cada um só vê o seu"),
 * então essa conta acontece inteira aqui no servidor — o navegador
 * nunca recebe dados de outros usuários além do que aparece no ranking
 * (nome, nível, XP, país inferido — nunca e-mail ou WhatsApp).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const scope = searchParams.get("scope") === "global" ? "global" : "nacional";

  if (!userId) {
    return Response.json({ error: "Usuário não informado." }, { status: 400 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: attended } = await supabase.from("attended_games").select("user_id, stadium, country, competition");
    const games = attended || [];

    // Junta usuários com pelo menos 1 jogo registrado — só esses entram
    // no ranking (sem jogo, sem XP, sem posição).
    const byUser = new Map();
    for (const g of games) {
      if (!byUser.has(g.user_id)) byUser.set(g.user_id, []);
      byUser.get(g.user_id).push(g);
    }

    // Busca os usuários (nome + data de criação) — pagina até 1000, que
    // cobre bem a escala atual do produto.
    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const usersById = new Map((userList?.users || []).map((u) => [u.id, u]));

    const entries = [];
    for (const [uid, userGames] of byUser) {
      const user = usersById.get(uid);
      if (!user) continue;

      const stadiums = new Set(userGames.map((g) => g.stadium).filter(Boolean));
      const countries = new Set(userGames.map((g) => g.country).filter(Boolean));
      const totalGames = userGames.length;
      const hasChampions = userGames.some((g) => /champions league/i.test(g.competition || ""));
      const completedBadges = [stadiums.size >= 5, countries.size >= 3, hasChampions].filter(Boolean).length;
      const xp = totalGames * 50 + stadiums.size * 100 + countries.size * 200 + completedBadges * 150;

      // País de casa: usa o que a pessoa cadastrou de verdade em Meu
      // Perfil, quando existir — só cai pra estimativa (país mais
      // frequente nos jogos dela) se ela nunca preencheu isso.
      const countryCounts = {};
      userGames.forEach((g) => { if (g.country) countryCounts[g.country] = (countryCounts[g.country] || 0) + 1; });
      const inferredCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const homeCountry = user.user_metadata?.country || inferredCountry;

      entries.push({
        userId: uid,
        name: user.user_metadata?.name || "Torcedor tripsz",
        avatarUrl: user.user_metadata?.avatar_url || null,
        xp,
        tier: tierName(xp),
        homeCountry,
        flag: COUNTRY_FLAGS[homeCountry] || "🌍",
      });
    }

    entries.sort((a, b) => b.xp - a.xp);

    const me = entries.find((e) => e.userId === userId);
    const myHomeCountry = me?.homeCountry || null;

    const filtered = scope === "nacional" && myHomeCountry
      ? entries.filter((e) => e.homeCountry === myHomeCountry)
      : entries;

    const ranked = filtered.map((e, i) => ({ ...e, position: i + 1 }));
    const podium = ranked.slice(0, 3);
    const rest = ranked.slice(3, 15);
    const myEntry = ranked.find((e) => e.userId === userId) || null;

    return Response.json({ podium, rest, myEntry, scope, total: ranked.length });
  } catch (e) {
    console.error("Erro em /api/ranking:", e);
    return Response.json({ error: e.message || "Não foi possível montar o ranking." }, { status: 500 });
  }
}
