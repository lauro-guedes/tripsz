/**
 * Lógica pura do calendário de jogos do Montar Viagem (sem rede, sem banco —
 * por isso dá pra testar sozinha). O que busca e guarda é o
 * lib/fixturesCalendar.js.
 */
import { CURATED_LEAGUE_IDS, EXCLUDED_STATUS, TIMEZONE, locateFixture } from "./gamesSearchCore";

/**
 * Países oferecidos no passo "Destino": nome na tela -> como a API-Football
 * escreve, código ISO e continente.
 */
export const WIZARD_COUNTRIES = {
  Inglaterra: { api: "England", iso: "GB", continent: "eu" },
  Espanha: { api: "Spain", iso: "ES", continent: "eu" },
  Itália: { api: "Italy", iso: "IT", continent: "eu" },
  Alemanha: { api: "Germany", iso: "DE", continent: "eu" },
  França: { api: "France", iso: "FR", continent: "eu" },
  Portugal: { api: "Portugal", iso: "PT", continent: "eu" },
  Holanda: { api: "Netherlands", iso: "NL", continent: "eu" },
  Turquia: { api: "Turkey", iso: "TR", continent: "eu" },
  Argentina: { api: "Argentina", iso: "AR", continent: "sa" },
  Brasil: { api: "Brazil", iso: "BR", continent: "sa" },
  Uruguai: { api: "Uruguay", iso: "UY", continent: "sa" },
  Chile: { api: "Chile", iso: "CL", continent: "sa" },
  Colômbia: { api: "Colombia", iso: "CO", continent: "sa" },
};

const LABEL_BY_API = Object.fromEntries(Object.entries(WIZARD_COUNTRIES).map(([label, c]) => [c.api, label]));
const LABEL_BY_ISO = Object.fromEntries(Object.entries(WIZARD_COUNTRIES).map(([label, c]) => [c.iso, label]));

/**
 * As mesmas ligas da busca de jogos, agora com o tipo e o calendário:
 *  - type: "league" (campeonato), "cup" (copa nacional) ou "continental"
 *  - calendar: "europe" (temporada começa em ~agosto: 2026 = 2026/27) ou
 *    "year" (temporada = ano do calendário)
 */
function meta(country, type, calendar) {
  return { country, type, calendar };
}
export const LEAGUE_META = {
  // Inglaterra
  39: meta("England", "league", "europe"), 40: meta("England", "league", "europe"),
  45: meta("England", "cup", "europe"), 48: meta("England", "cup", "europe"),
  // Espanha
  140: meta("Spain", "league", "europe"), 141: meta("Spain", "league", "europe"), 143: meta("Spain", "cup", "europe"),
  // Itália
  135: meta("Italy", "league", "europe"), 136: meta("Italy", "league", "europe"), 137: meta("Italy", "cup", "europe"),
  // Alemanha
  78: meta("Germany", "league", "europe"), 79: meta("Germany", "league", "europe"), 81: meta("Germany", "cup", "europe"),
  // França
  61: meta("France", "league", "europe"), 62: meta("France", "league", "europe"), 66: meta("France", "cup", "europe"),
  // Portugal
  94: meta("Portugal", "league", "europe"), 95: meta("Portugal", "league", "europe"), 96: meta("Portugal", "cup", "europe"),
  // Holanda e Turquia
  88: meta("Netherlands", "league", "europe"), 89: meta("Netherlands", "league", "europe"), 203: meta("Turkey", "league", "europe"),
  // América do Sul
  71: meta("Brazil", "league", "year"), 72: meta("Brazil", "league", "year"), 73: meta("Brazil", "cup", "year"),
  128: meta("Argentina", "league", "year"), 129: meta("Argentina", "league", "year"),
  268: meta("Uruguay", "league", "year"), 265: meta("Chile", "league", "year"), 239: meta("Colombia", "league", "year"),
  // Continentais: Champions, Europa League, Conference | Libertadores, Sul-Americana
  2: meta("World", "continental", "europe"), 3: meta("World", "continental", "europe"), 848: meta("World", "continental", "europe"),
  13: meta("World", "continental", "year"), 11: meta("World", "continental", "year"),
};
const CONTINENTAL_BY_CONTINENT = { eu: [2, 3, 848], sa: [13, 11] };

export const COMPETITION_TYPE_LABEL = { league: "Campeonato", cup: "Copa", continental: "Competição continental" };

/** Quais ligas precisam estar no calendário pra atender esses países da tela. */
export function leagueIdsForCountries(labels) {
  const apis = new Set(labels.map((l) => WIZARD_COUNTRIES[l]?.api).filter(Boolean));
  const continents = new Set(labels.map((l) => WIZARD_COUNTRIES[l]?.continent).filter(Boolean));
  const ids = new Set();
  for (const [id, m] of Object.entries(LEAGUE_META)) if (m.type !== "continental" && apis.has(m.country)) ids.add(Number(id));
  for (const c of continents) for (const id of CONTINENTAL_BY_CONTINENT[c] || []) ids.add(id);
  return [...ids].sort((a, b) => a - b);
}

/** Temporada (no padrão da API) a que uma data pertence. */
export function seasonFor(leagueMeta, dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  return leagueMeta.calendar === "europe" ? (m >= 8 ? y : y - 1) : y;
}
export function seasonsForWindow(leagueMeta, from, to) {
  return [...new Set([seasonFor(leagueMeta, from), seasonFor(leagueMeta, to)])];
}

// Em competição continental, a cidade manda — e "Reino Unido" não é só Inglaterra.
const NON_ENGLAND_GB_CITIES = new Set(["glasgow", "edinburgh", "aberdeen", "dundee", "inverness", "motherwell", "kilmarnock", "paisley", "cardiff", "swansea", "newport", "wrexham", "belfast", "derry", "londonderry"]);
const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * A qual país da tela esse jogo pertence? Liga/copa nacional: o país da
 * competição (assim o AS Monaco entra em "França", mesmo a cidade sendo em
 * Mônaco). Competição continental: o país onde o jogo acontece.
 */
export function labelForRow(row) {
  const m = LEAGUE_META[row.league_id];
  if (!m) return null;
  if (m.type !== "continental") return LABEL_BY_API[m.country] || null;
  const cc = row.venue_cc;
  if (!cc) return null;
  if (cc === "GB" && NON_ENGLAND_GB_CITIES.has(norm(row.venue_city))) return null;
  return LABEL_BY_ISO[cc] || null;
}

/** Flexibilidade das datas (passo "Datas" do questionário): dias de folga pra cada lado. */
export const FLEX_PAD_DAYS = { fixed: 0, some: 7, flex: 21 };

/** Soma dias a uma data AAAA-MM-DD. */
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Jogos que ainda vão acontecer (não adiados, suspensos ou cancelados). */
const NOT_PLAYABLE = new Set(["PST", "SUSP", "INT", "CANC", "ABD", "AWD", "WO"]);
export function isPlayable(status) {
  return !NOT_PLAYABLE.has(status);
}

/** Data (AAAA-MM-DD) do jogo no horário de Brasília — a mesma usada na busca de jogos. */
export function brasiliaDate(kickoffIso) {
  return new Date(kickoffIso).toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/**
 * Transforma os jogos que vieram da API (de uma liga/temporada) nas linhas
 * da tabela fixtures_calendar: já com o local (coordenada e país da cidade),
 * a capacidade do estádio, a competição e a rodada.
 */
export function toCalendarRows(apiFixtures, { fetchedAt, findCity, countryCodeFromName, venueInfo, homeTeamInfo }) {
  const rows = [];
  for (const f of apiFixtures) {
    const leagueId = f.league?.id;
    const m = LEAGUE_META[leagueId];
    if (!m || !CURATED_LEAGUE_IDS.has(leagueId)) continue;
    const status = f.fixture?.status?.short || null;
    if (EXCLUDED_STATUS.has(status)) continue;

    const loc = locateFixture(f, { findCity, countryCodeFromName, venueInfo, homeTeamInfo });

    // Capacidade: a do cadastro do estádio do jogo, ou a do estádio do time da
    // casa quando o jogo é nele (mesmo nome, ou quando foi o local escolhido).
    let capacity = null;
    const vinfo = f.fixture?.venue?.id && venueInfo ? venueInfo(f.fixture.venue.id) : null;
    if (vinfo && vinfo.capacity) capacity = vinfo.capacity;
    if (!capacity && homeTeamInfo && f.teams?.home?.id) {
      const t = homeTeamInfo(f.teams.home.id);
      if (t && t.venueCapacity) {
        // O nome do estádio no jogo e no cadastro do time costuma divergir (renomeações:
        // "New Balance Arena" x "Gewiss Stadium"). Se o jogo é na MESMA CIDADE do estádio do
        // time da casa (comparando as coordenadas, então "Milan" = "Milano"), é o mesmo estádio.
        const teamGeo = t.city ? findCity(t.city, countryCodeFromName(t.country)) : null;
        const sameCity = !!(teamGeo && loc.geo && teamGeo.lat === loc.geo.lat && teamGeo.lon === loc.geo.lon);
        const sameName = norm(t.venueName) === norm(f.fixture?.venue?.name);
        if (loc.precision === "team-home" || !f.fixture?.venue?.name || sameName || sameCity) capacity = t.venueCapacity;
      }
    }

    rows.push({
      fixture_id: f.fixture.id,
      kickoff: f.fixture.date,
      match_date: brasiliaDate(f.fixture.date),
      league_id: leagueId,
      league_name: f.league.name,
      league_country: f.league.country,
      league_season: f.league.season || null,
      league_round: f.league.round || null,
      competition_type: m.type,
      home_team_id: f.teams?.home?.id || null,
      home_team: f.teams?.home?.name,
      home_logo: f.teams?.home?.logo || null,
      away_team_id: f.teams?.away?.id || null,
      away_team: f.teams?.away?.name,
      away_logo: f.teams?.away?.logo || null,
      venue_name: loc.venueName,
      venue_city: loc.displayCity,
      venue_capacity: capacity,
      venue_cc: loc.geo ? loc.geo.cc || null : null,
      lat: loc.geo ? loc.geo.lat : null,
      lon: loc.geo ? loc.geo.lon : null,
      geo_precision: loc.precision,
      status,
      fetched_at: fetchedAt,
    });
  }
  return rows;
}
