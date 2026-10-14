import { wikiVenueInfo } from "@/lib/venueWiki";
import { getFixtureDetails, lookupVenueById, venueByName, venuePayload } from "@/lib/gameDetails";
import { authUser } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => Response.json(body, { status, headers: NO_STORE });

/**
 * GET /api/games/details?gameId=<id do jogo em attended_games>
 *
 * Alimenta o modal "Detalhes da experiência" de Meus Jogos: escalação, gols,
 * estatísticas e estádio de um jogo que a PESSOA registrou. Só devolve jogo
 * dela (o servidor confere o login e o dono — nunca confia em userId vindo do
 * navegador).
 *
 *  - jogo registrado à mão (sem ID da API): { available: false, reason: "manual", venue }
 *  - API indisponível/sem o jogo:            { available: false, reason: "unavailable", venue }
 *  - ok:                                     { available: true, details }
 */
export async function GET(request) {
  const user = await authUser(request);
  if (!user) return json({ error: "Faça login para ver os detalhes do jogo." }, 401);

  const gameId = new URL(request.url).searchParams.get("gameId");
  if (!gameId) return json({ error: "Informe o jogo (gameId)." }, 400);

  const supabase = supabaseAdmin();
  const { data: game, error } = await supabase.from("attended_games").select("id, api_fixture_id, stadium, city, country").eq("id", gameId).eq("user_id", user.id).maybeSingle();
  if (error) return json({ error: "Não foi possível carregar o jogo agora." }, 500);
  if (!game) return json({ error: "Jogo não encontrado." }, 404);

  // Sem vínculo com a partida: só o estádio (achado pelo nome) fica disponível.
  if (!game.api_fixture_id) return json({ available: false, reason: "manual", venue: await venueByName(supabase, game) });

  const got = await getFixtureDetails(supabase, game.api_fixture_id);
  if (got.error) return json({ available: false, reason: "unavailable", venue: await venueByName(supabase, game) });

  // Estádio e país: vale o que a pessoa registrou. A CIDADE vem do cadastro do estádio (por ID), que
  // escreve certo ("Belo Horizonte"); o texto do jogo às vezes erra ("Bello Harisanta") — inclusive nos
  // detalhes que já ficaram guardados. Se a API não trouxe o ID ou a capacidade, completa pelo nome.
  const v = got.details.venue || {};
  const reg = v.id ? await lookupVenueById(supabase, v.id) : null;
  let capacity = v.capacity || (reg && reg.capacity) || null;
  const extra = !v.id || !capacity ? await venueByName(supabase, game) : null;
  if (!capacity && extra && extra.capacity) capacity = extra.capacity;
  // Ainda sem capacidade (a API-Football não cobre todos os estádios): busca no Wikidata, com limite de tempo.
  if (!capacity && (game.stadium || v.name)) {
    const wiki = await Promise.race([
      wikiVenueInfo(game.stadium || v.name, (reg && reg.city) || (extra && extra.city) || v.city || game.city),
      new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
    ]).catch(() => null);
    if (wiki && wiki.capacity) capacity = wiki.capacity;
  }
  const venue = venuePayload({
    id: v.id || (extra && extra.id) || null,
    name: game.stadium || v.name || null,
    city: (reg && reg.city) || (extra && extra.city) || v.city || game.city || null,
    country: game.country || v.country || null,
    capacity,
    image: v.image || (extra && extra.image) || null,
  });
  return json({ available: true, details: { ...got.details, venue } });
}
