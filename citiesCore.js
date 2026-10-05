/**
 * Lógica pura de cidades (sem ler arquivo nenhum) — recebe os dados de
 * fora. Fica separada de lib/cities.js só pra dar pra testar sozinha.
 *
 * Os dados vêm da base aberta GeoNames (cidades com mais de ~5 mil
 * habitantes): nome, país, latitude/longitude, população e, nas cidades
 * grandes, os nomes alternativos (ex: "Milano" pra Milan).
 */

// Códigos de estado do Brasil usados pela GeoNames -> sigla.
const BR_STATES = {
  "01": "AC", "02": "AL", "03": "AP", "04": "AM", "05": "BA", "06": "CE",
  "07": "DF", "08": "ES", "11": "MS", "13": "MA", "14": "MT", "15": "MG",
  "16": "PA", "17": "PB", "18": "PR", "20": "PI", "21": "RJ", "22": "RN",
  "23": "RS", "24": "RO", "25": "RR", "26": "SC", "27": "SP", "28": "SE",
  "29": "GO", "30": "PE", "31": "TO",
};

/**
 * Bairros e distritos que a API-Football usa como "cidade" do estádio mas
 * que não são cidades de verdade na base. Formato: "PAÍS|nome normalizado"
 * -> cidade que vale pra distância. Vai crescendo conforme aparecer caso
 * novo (o log da busca mostra quantos jogos ficaram sem localização).
 */
const VENUE_CITY_ALIASES = {
  "AR|dock sud": "Avellaneda",
  "AR|flores": "Buenos Aires",
};

export function normalize(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function createCityIndex(rawCities, rawCountries) {
  const cities = rawCities.map(([name, cc, lat, lon, pop, a1, alts]) => ({
    name, cc, lat, lon, pop, a1, k: normalize(name), alts: alts || [],
  }));

  // nome normalizado (principal ou alternativo) -> cidades com esse nome
  const byName = new Map();
  const add = (key, city) => {
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(city);
  };
  for (const c of cities) {
    add(c.k, c);
    for (const a of c.alts) add(a, c);
  }

  const regionNames = typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["pt-BR"], { type: "region" })
    : null;
  const countryName = (cc) => {
    try { return (regionNames && regionNames.of(cc)) || cc; } catch { return cc; }
  };

  function labelOf(c) {
    const parts = [c.name];
    if (c.cc === "BR" && BR_STATES[c.a1]) parts.push(BR_STATES[c.a1]);
    parts.push(countryName(c.cc));
    return parts.join(", ");
  }

  function toSuggestion(c) {
    return { label: labelOf(c), name: c.name, country: c.cc, lat: c.lat, lon: c.lon };
  }

  /** Autocomplete: começa com / alguma palavra começa com / nome alternativo. */
  function suggest(query, limit = 6) {
    const q = normalize(query);
    if (q.length < 2) return [];
    const scored = [];
    for (const c of cities) {
      let rank = -1;
      if (c.k === q) rank = 0;
      else if (c.k.startsWith(q)) rank = 1;
      else if (c.k.split(" ").some((w) => w.startsWith(q))) rank = 2;
      else if (c.alts.some((a) => a.startsWith(q))) rank = 3;
      if (rank >= 0) scored.push([rank, c]);
    }
    // Nome alternativo só entra quando nada bate com o nome principal —
    // senão "sao pau" traria Luanda (que já se chamou "São Paulo de Luanda").
    const hasPrimary = scored.some(([r]) => r < 3);
    const pool = hasPrimary ? scored.filter(([r]) => r < 3) : scored;
    pool.sort((a, b) => a[0] - b[0] || b[1].pop - a[1].pop);
    const seen = new Set();
    const out = [];
    for (const [, c] of pool) {
      const label = labelOf(c);
      if (seen.has(label)) continue;
      seen.add(label);
      out.push(toSuggestion(c));
      if (out.length >= limit) break;
    }
    return out;
  }

  /** Nome do país como a API-Football escreve ("Costa-Rica") -> código ISO, ou null. */
  function countryCodeFromName(name) {
    if (!name) return null;
    return rawCountries[normalize(name).replace(/-/g, " ")] || null;
  }

  /**
   * Acha a cidade de um estádio. O texto vem da API-Football, às vezes com
   * estado junto ("Brasília, Distrito Federal") — usa só a parte antes da
   * vírgula. Com o país conhecido, filtra por ele; sem país, pega a mais
   * populosa com esse nome (menos preciso).
   * Devolve { lat, lon, precision } ou null.
   */
  function findCity(rawCity, countryCode) {
    if (!rawCity) return null;
    let key = normalize(String(rawCity).split(",")[0]);
    if (!key) return null;
    if (countryCode && VENUE_CITY_ALIASES[`${countryCode}|${key}`]) {
      key = normalize(VENUE_CITY_ALIASES[`${countryCode}|${key}`]);
    }
    let hits = byName.get(key) || [];
    if (countryCode) {
      hits = hits.filter((c) => c.cc === countryCode);
      if (hits.length === 0) return null;
    }
    if (hits.length === 0) return null;
    const best = hits.reduce((a, b) => (b.pop > a.pop ? b : a));
    return { lat: best.lat, lon: best.lon, precision: countryCode ? "city" : "city-approx" };
  }

  return { suggest, findCity, countryCodeFromName, size: cities.length };
}
