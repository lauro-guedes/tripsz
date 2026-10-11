import { getFixtureDetails, venueByName, venuePayload } from "@/lib/gameDetails";
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

  const localVenue = await venueByName(supabase, game);
  if (!game.api_fixture_id) return json({ available: false, reason: "manual", venue: localVenue });

  const got = await getFixtureDetails(supabase, game.api_fixture_id);
  if (got.error) return json({ available: false, reason: "unavailable", venue: localVenue });

  // O que a pessoa registrou (estádio/cidade/país) vale mais que o cadastro da API.
  const v = got.details.venue || {};
  const venue = venuePayload({
    id: v.id || null,
    name: game.stadium || v.name || null,
    city: game.city || v.city || null,
    country: game.country || v.country || null,
    capacity: v.capacity || localVenue.capacity || null,
  });
  return json({ available: true, details: { ...got.details, venue } });
}
