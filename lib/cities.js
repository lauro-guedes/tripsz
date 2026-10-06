import CITIES from "./data/cities";
import { COUNTRY_CODES, CITY_ALIASES, VENUE_CITY_ALIASES } from "./data/geoExtras";
import { createCityIndex, haversineKm } from "./citiesCore";

// Monta o índice uma vez só por instância do servidor (leva uns
// milissegundos) e reaproveita nas próximas chamadas.
let index = null;
function getIndex() {
  if (!index) index = createCityIndex(CITIES, COUNTRY_CODES, CITY_ALIASES, VENUE_CITY_ALIASES);
  return index;
}

export function suggestCities(query, limit) {
  return getIndex().suggest(query, limit);
}

export function findCity(rawCity, countryCode) {
  return getIndex().findCity(rawCity, countryCode);
}

export function countryCodeFromName(name) {
  return getIndex().countryCodeFromName(name);
}

export { haversineKm };
