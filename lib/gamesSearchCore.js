/**
 * Lógica pura da busca de jogos por cidade (sem rede, sem banco) — fica
 * separada de lib/gamesSearch.js só pra dar pra testar sozinha.
 */
import { haversineKm } from "./citiesCore";

export const TIMEZONE = "America/Sao_Paulo";

/**
 * Ligas que entram na busca. É de propósito uma lista CURADA: a API
 * devolve centenas de ligas por dia, mas nas pequenas (base, divisões
 * inferiores) a maioria dos jogos vem sem nome de estádio/cidade, e sem
 * isso não dá pra calcular distância. Pra incluir mais uma liga, é só
 * somar o ID dela aqui.
 */
export const CURATED_LEAGUE_IDS = new Set([
  // Inglaterra: Premier League, Championship, FA Cup, Copa da Liga
  39, 40, 45, 48,
  // Espanha: La Liga, Segunda, Copa del Rey
  140, 141, 143,
  // Itália: Serie A, Serie B, Coppa Italia
  135, 136, 137,
  // Alemanha: Bundesliga, 2. Bundesliga, DFB Pokal
  78, 79, 81,
  // França: Ligue 1, Ligue 2, Coupe de France
  61, 62, 66,
  // Portugal: Primeira Liga, Liga Portugal 2, Taça de Portugal
  94, 95, 96,
  // Holanda: Eredivisie, Eerste Divisie
  88, 89,
  // Turquia: Süper Lig
  203,
  // Brasil: Série A, Série B, Copa do Brasil
  71, 72, 73,
  // Argentina: Liga Profesional, Primera Nacional
  128, 129,
  // Uruguai, Chile, Colômbia
  268, 265, 239,
  // UEFA: Champions, Europa League, Conference League
  2, 3, 848,
  // CONMEBOL: Libertadores, Sul-Americana
  13, 11,
]);

// Jogos que não vão acontecer — não faz sentido oferecer pra alguém ir.
export const EXCLUDED_STATUS = new Set(["CANC", "ABD", "AWD", "WO"]);

/** Data de hoje (YYYY-MM-DD) no fuso de Brasília. */
export function todayInSaoPaulo(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Devolve uma mensagem de erro, ou null se a data é válida pra busca. */
export function validateDate(dateStr, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return "Data inválida. Use o formato AAAA-MM-DD.";
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(d) || d.toISOString().slice(0, 10) !== dateStr) return "Data inválida.";
  const today = todayInSaoPaulo(now);
  if (dateStr < addDays(today, -30)) return "Essa data já passou há muito tempo.";
  if (dateStr > addDays(today, 180)) return "Só dá pra buscar jogos dos próximos 6 meses.";
  return null;
}

/** Por quantas horas os jogos de uma data ficam guardados antes de pedir de novo à API. */
export function ttlHoursFor(dateStr, now = new Date()) {
  return dateStr < todayInSaoPaulo(now) ? 24 * 7 : 6;
}

/**
 * Transforma a resposta da API-Football (jogos de um dia) nas linhas que
 * a gente guarda: só ligas curadas, sem jogos cancelados, já com a
 * latitude/longitude da cidade do estádio.
 */
/** Resolve a cidade de um jogo pelo texto que vem no próprio jogo (ou null). */
function matchOwnCity(f, { findCity, countryCodeFromName }) {
  const venueCity = f.fixture?.venue?.city || null;
  if (!venueCity) return null;
  // "World" (competições continentais) não tem país -> código null ->
  // a busca da cidade fica menos precisa ("city-approx").
  return findCity(venueCity, countryCodeFromName(f.league?.country));
}

/**
 * IDs dos estádios cujo jogo ficou SEM localização pelo texto que veio
 * na API. A API escreve algumas cidades do jeito errado nos jogos
 * ("Bello Harisanta" por Belo Horizonte, "Punta Grossa" por Ponta
 * Grossa), mas no cadastro do estádio (por ID) o nome vem certo. Esses
 * IDs são os que vale consultar lá.
 */
export function venueIdsNeedingLookup(apiFixtures, helpers) {
  const ids = new Set();
  for (const f of apiFixtures) {
    if (!CURATED_LEAGUE_IDS.has(f.league?.id)) continue;
    if (EXCLUDED_STATUS.has(f.fixture?.status?.short)) continue;
    const id = f.fixture?.venue?.id;
    if (id && !matchOwnCity(f, helpers)) ids.add(id);
  }
  return [...ids];
}

/**
 * Tenta achar o local do jogo SEM olhar o time da casa: primeiro pelo texto
 * que veio no próprio jogo, depois pelo cadastro do estádio (por ID).
 * Devolve { geo, displayCity }.
 */
function locateByVenue(f, { findCity, countryCodeFromName, venueInfo }) {
  let geo = matchOwnCity(f, { findCity, countryCodeFromName });
  let displayCity = f.fixture?.venue?.city || null;
  if (!geo && venueInfo && f.fixture?.venue?.id) {
    const info = venueInfo(f.fixture.venue.id);
    if (info && info.city) {
      geo = findCity(info.city, countryCodeFromName(info.country));
      // O cadastro vem certo ("Belo Horizonte, Minas Gerais"): mostra ele
      // no card no lugar do texto errado que veio no jogo.
      if (geo) displayCity = info.city.split(",")[0].trim();
    }
  }
  return { geo, displayCity };
}

/**
 * IDs dos times da casa cujo jogo continua SEM localização depois das duas
 * tentativas acima. Jogo futuro quase nunca vem com ID de estádio, e uns 15%
 * vêm sem nome nem cidade — mas o estádio do time da casa vem limpo no
 * cadastro do time, e a maioria dos jogos é lá.
 */
export function teamIdsNeedingLookup(apiFixtures, helpers, venueInfo) {
  const ids = new Set();
  for (const f of apiFixtures) {
    if (!CURATED_LEAGUE_IDS.has(f.league?.id)) continue;
    if (EXCLUDED_STATUS.has(f.fixture?.status?.short)) continue;
    const teamId = f.teams?.home?.id;
    if (teamId && !locateByVenue(f, { ...helpers, venueInfo }).geo) ids.add(teamId);
  }
  return [...ids];
}

/**
 * Descobre ONDE o jogo acontece, na ordem: texto do próprio jogo -> cadastro
 * do estádio (por ID) -> estádio do time da casa. Devolve
 * { geo, displayCity, venueName, precision } (geo é null se não achou).
 * Usada pela busca de jogos e pelo calendário do Montar Viagem.
 */
export function locateFixture(f, { findCity, countryCodeFromName, venueInfo, homeTeamInfo }) {
  let { geo, displayCity } = locateByVenue(f, { findCity, countryCodeFromName, venueInfo });
  let venueName = f.fixture?.venue?.name || null;
  let precision = geo ? geo.precision : "none";

  // Última tentativa: o estádio do time da casa. Fica marcado como
  // "team-home" (local provável) porque em jogo de campo neutro, final
  // ou estádio provisório o jogo pode ser em outro lugar.
  if (!geo && homeTeamInfo && f.teams?.home?.id) {
    const info = homeTeamInfo(f.teams.home.id);
    if (info && info.city) {
      const viaTeam = findCity(info.city, countryCodeFromName(info.country));
      if (viaTeam) {
        geo = viaTeam;
        precision = "team-home";
        displayCity = info.city.split(",")[0].trim();
        if (!venueName) venueName = info.venueName || null;
      }
    }
  }
  return { geo, displayCity, venueName, precision };
}

export function normalizeFixtures(apiFixtures, { date, fetchedAt, findCity, countryCodeFromName, venueInfo, homeTeamInfo }) {
  const rows = [];
  for (const f of apiFixtures) {
    if (!CURATED_LEAGUE_IDS.has(f.league?.id)) continue;
    const status = f.fixture?.status?.short || null;
    if (EXCLUDED_STATUS.has(status)) continue;

    const { geo, displayCity, venueName, precision } = locateFixture(f, { findCity, countryCodeFromName, venueInfo, homeTeamInfo });

    rows.push({
      fixture_id: f.fixture.id,
      match_date: date,
      kickoff: f.fixture.date,
      league_id: f.league.id,
      league_name: f.league.name,
      league_country: f.league.country,
      home_team: f.teams?.home?.name,
      home_logo: f.teams?.home?.logo || null,
      away_team: f.teams?.away?.name,
      away_logo: f.teams?.away?.logo || null,
      venue_name: venueName,
      venue_city: displayCity,
      lat: geo ? geo.lat : null,
      lon: geo ? geo.lon : null,
      geo_precision: precision,
      status,
      fetched_at: fetchedAt,
    });
  }
  return rows;
}

/**
 * Filtra pelo raio e ordena do mais perto pro mais longe. Jogos sem
 * localização (cidade desconhecida) não entram — vêm contados à parte.
 */
export function rankByDistance(rows, { lat, lon, radiusKm }) {
  const located = rows.filter((r) => r.lat != null && r.lon != null);
  const games = located
    .map((r) => ({ ...r, distanceKmExact: haversineKm(lat, lon, r.lat, r.lon) }))
    .filter((r) => r.distanceKmExact <= radiusKm)
    .sort((a, b) => a.distanceKmExact - b.distanceKmExact || new Date(a.kickoff) - new Date(b.kickoff))
    .map(({ distanceKmExact, ...r }) => ({ ...r, distance_km: Math.round(distanceKmExact) }));
  return { games, unlocated: rows.length - located.length };
}
