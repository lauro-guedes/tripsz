/**
 * Lógica pura de cidades (sem ler arquivo nenhum) — recebe os dados de
 * fora. Fica separada de lib/cities.js só pra dar pra testar sozinha.
 *
 * Os dados vêm da base aberta GeoNames (cidades com 20 mil habitantes ou
 * mais): nome, país, latitude/longitude e população. Nomes em português ou no
 * idioma local (ex: "Milão", "Milano" pra Milan) vêm de uma lista de apelidos.
 */

// Códigos de estado do Brasil usados pela GeoNames -> sigla.
const BR_STATES = {
  "01": "AC", "02": "AL", "03": "AP", "04": "AM", "05": "BA", "06": "CE",
  "07": "DF", "08": "ES", "11": "MS", "13": "MA", "14": "MT", "15": "MG",
  "16": "PA", "17": "PB", "18": "PR", "20": "PI", "21": "RJ", "22": "RN",
  "23": "RS", "24": "RO", "25": "RR", "26": "SC", "27": "SP", "28": "SE",
  "29": "GO", "30": "PE", "31": "TO",
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

export function createCityIndex(citiesText, countryCodes, aliases = {}, venueAliases = {}) {
  // Uma cidade por pedaço, separadas por ";" ou quebra de linha.
  const cities = [];
  for (const line of citiesText.split(/[\n;]/)) {
    if (!line) continue;
    const [cc, name, lat, lon, popK, a1] = line.split("|");
    if (!name) continue;
    cities.push({ name, cc, lat: parseFloat(lat), lon: parseFloat(lon), pop: parseInt(popK, 10) * 1000, a1: a1 || "", k: normalize(name), alts: [] });
  }

  // nome normalizado -> cidades com esse nome
  const byName = new Map();
  const add = (key, city) => {
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(city);
  };
  for (const c of cities) add(c.k, c);

  // Apelidos (nomes em português, no idioma local...): apontam pra cidade
  // mais populosa com o nome indicado, naquele país.
  for (const [alias, [targetName, targetCc]] of Object.entries(aliases)) {
    const key = normalize(targetName);
    const target = (byName.get(key) || []).filter((c) => c.cc === targetCc).sort((a, b) => b.pop - a.pop)[0];
    if (!target) continue;
    target.alts.push(alias);
    add(alias, target);
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
      if (c.k === q || c.alts.includes(q)) rank = 0; // nome exato (principal ou apelido)
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
    return countryCodes[normalize(name).replace(/-/g, " ")] || null;
  }

  /** Cidade mais populosa com esse nome normalizado (no país, se informado). */
  function lookup(key, countryCode) {
    let hits = byName.get(key) || [];
    if (countryCode) hits = hits.filter((c) => c.cc === countryCode);
    return hits.length ? hits.reduce((a, b) => (b.pop > a.pop ? b : a)) : null;
  }

  /**
   * Acha a cidade de um estádio. O texto vem da API-Football e varia
   * bastante ("Brasília, Distrito Federal", "Ciudad de Córdoba, Provincia
   * de Córdoba", "Mainz-Mombach"...), então tenta em ordem:
   *  1. a lista de apelidos de estádio daquele país;
   *  2. o nome exato (usa só a parte antes da vírgula);
   *  3. sem o prefixo "Ciudad de ";
   *  4. sem o que vem entre parênteses;
   *  5. só a parte antes do hífen — mas só se for uma cidade grande
   *     (100 mil habitantes ou mais), pra "Mainz-Mombach" virar Mainz.
   * Com o país conhecido, filtra por ele; sem país, pega a mais populosa
   * com esse nome (menos preciso). Devolve { lat, lon, precision } ou null.
   */
  function findCity(rawCity, countryCode) {
    if (!rawCity) return null;
    const key = normalize(String(rawCity).split(",")[0]);
    if (!key) return null;

    const attempt = (k) => {
      if (countryCode && venueAliases[`${countryCode}|${k}`]) {
        // "Nome" (mesmo país) ou "Nome|CC" (cidade em outro país — ex: o
        // AS Monaco é de clube francês, mas a cidade fica em Mônaco).
        const [targetName, targetCc] = venueAliases[`${countryCode}|${k}`].split("|");
        const viaAlias = lookup(normalize(targetName), targetCc || countryCode);
        if (viaAlias) return viaAlias;
      }
      return lookup(k, countryCode);
    };

    let hit = attempt(key);
    if (!hit) {
      const noPrefix = key.replace(/^ciudad (autonoma )?de /, "");
      if (noPrefix !== key) hit = attempt(noPrefix);
    }
    if (!hit) {
      const noParens = key.replace(/\s*\(.*$/, "").trim();
      if (noParens && noParens !== key) hit = attempt(noParens);
    }
    if (!hit && countryCode && key.includes("-")) {
      const head = lookup(key.split("-")[0].trim(), countryCode);
      if (head && head.pop >= 100000) hit = head;
    }
    if (!hit) return null;
    return { lat: hit.lat, lon: hit.lon, precision: countryCode ? "city" : "city-approx", cc: hit.cc, name: hit.name };
  }

  return { suggest, findCity, countryCodeFromName, size: cities.length };
}
