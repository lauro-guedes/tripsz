/** tripsz.social (Fase 2) — criar e apagar posts e check-ins, e os estádios que a pessoa já visitou (SÓ no servidor). */
import { CHECKINS_PER_DAY, CHECKIN_REPEAT_HOURS, POSTS_PER_DAY, POST_BODY_MAX, cleanPhotos, cleanPostBody, cleanVisibility } from "./socialPostRules";
import { stadiumsNear } from "./socialCheckin";
import { POST_COLS, UUID, decoratePosts, viewerContext } from "./socialPostsShared";
import { fail, must } from "./socialShared";

const GAME_COLS = "id, stadium, city, country, home_team, away_team, match_date, competition, created_at";
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

async function myGames(supabase, userId) {
  const { data } = must(await supabase.from("attended_games").select(GAME_COLS).eq("user_id", userId).limit(5000));
  return data || [];
}

/** Os estádios que a pessoa já visitou (do Passaporte), com os jogos de cada um: o "Local" e o "Jogo" da Nova Publicação. */
export async function getVisitedStadiums(supabase, user) {
  const by = new Map();
  for (const g of await myGames(supabase, user.id)) {
    if (!g.stadium) continue;
    const s = by.get(g.stadium) || { name: g.stadium, city: g.city || null, country: g.country || null, visits: 0, games: [] };
    s.visits += 1;
    s.games.push({ id: g.id, home: g.home_team, away: g.away_team, date: g.match_date, competition: g.competition || null });
    by.set(g.stadium, s);
  }
  const stadiums = [...by.values()].sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name)).map((s) => ({ ...s, games: s.games.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5) }));
  return { ok: true, stadiums };
}

async function countSince(supabase, userId, kind, sinceIso) {
  const { count } = must(await supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("kind", kind).gte("created_at", sinceIso));
  return count || 0;
}

/**
 * Cria um post ("post": sobre um estádio que a pessoa JÁ visitou) ou um check-in ("checkin": ela ESTÁ no estádio, confirmado pelo GPS).
 * body: { kind, body?, photos?, visibility?, stadium + gameId? (post) | lat, lon, accuracy?, stadiumKey, fixtureId? (check-in) }
 */
export async function createPost(supabase, user, input, { supabaseUrl, now = Date.now() } = {}) {
  const b = input && typeof input === "object" ? input : {};
  const kind = b.kind === "post" || b.kind === "checkin" ? b.kind : null;
  if (!kind) return fail("invalid_field");
  const visibility = cleanVisibility(b.visibility == null ? "public" : b.visibility);
  if (!visibility) return fail("invalid_field", "Escolha quem pode ver.");
  if (b.body != null && (typeof b.body !== "string" || b.body.length > POST_BODY_MAX * 3)) return fail("invalid_field", `O texto pode ter até ${POST_BODY_MAX} caracteres.`);
  const text = cleanPostBody(b.body);
  const ph = cleanPhotos(b.photos, { uid: user.id, supabaseUrl });
  if (!ph.ok) return fail("invalid_media", "Alguma foto não é permitida (máximo de 4, enviadas por você).");
  const day = new Date(now - 24 * 3600 * 1000).toISOString();
  if ((await countSince(supabase, user.id, kind, day)) >= (kind === "post" ? POSTS_PER_DAY : CHECKINS_PER_DAY)) return fail("daily_limit");

  const row = { author_id: user.id, kind, body: text || null, photos: ph.photos, visibility };
  if (kind === "post") {
    if (!text && ph.photos.length === 0) return fail("invalid_field", "Escreva algo ou adicione uma foto.");
    const games = (await myGames(supabase, user.id)).filter((g) => g.stadium && g.stadium === b.stadium);
    if (games.length === 0) return fail("not_visited");
    Object.assign(row, { stadium_name: games[0].stadium, stadium_city: games[0].city || null, stadium_country: games[0].country || null });
    if (b.gameId != null) {
      const g = games.find((x) => String(x.id) === String(b.gameId));
      if (!g) return fail("invalid_field", "Esse jogo não é seu ou não foi nesse estádio.");
      Object.assign(row, { game_home: g.home_team, game_away: g.away_team, game_date: g.match_date || null, game_competition: g.competition || null });
    }
  } else {
    const near = await stadiumsNear(supabase, { lat: b.lat, lon: b.lon, accuracy: b.accuracy, now });
    if (near.error) return near;
    const st = near.stadiums.find((s) => s.key === b.stadiumKey);
    if (!st || !st.atStadium) return fail("not_at_stadium");
    const since = new Date(now - CHECKIN_REPEAT_HOURS * 3600 * 1000).toISOString();
    const { count } = must(await supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id).eq("kind", "checkin").eq("stadium_name", st.name).gte("created_at", since));
    if ((count || 0) > 0) return fail("checkin_repeat");
    Object.assign(row, { stadium_name: st.name, stadium_city: st.city, stadium_country: st.country });
    if (b.fixtureId != null) {
      const g = st.games.find((x) => String(x.fixtureId) === String(b.fixtureId));
      if (!g) return fail("invalid_field", "Esse jogo não está acontecendo agora nesse estádio.");
      Object.assign(row, { game_home: g.home, game_away: g.away, game_date: String(g.kickoff).slice(0, 10), game_competition: g.competition || null, game_fixture_id: num(g.fixtureId) });
    }
  }
  const { data, error } = await supabase.from("posts").insert(row).select(POST_COLS).single();
  if (error || !data) return fail("server");
  const posts = await decoratePosts(supabase, user.id, [data], await viewerContext(supabase, user.id));
  return { ok: true, post: posts[0] };
}

/** Apaga (some do feed e do perfil) um post da própria pessoa. */
export async function deletePost(supabase, user, id) {
  if (!UUID.test(String(id))) return fail("not_found", "Publicação não encontrada.");
  const { data } = must(await supabase.from("posts").select("id").eq("id", id).eq("author_id", user.id).is("deleted_at", null).maybeSingle());
  if (!data) return fail("not_found", "Publicação não encontrada.");
  const { error } = await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("author_id", user.id);
  return error ? fail("server") : { ok: true };
}
