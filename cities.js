import rawCities from "./data/cities.json";
import rawCountries from "./data/countries.json";
import { createCityIndex, haversineKm } from "./citiesCore";

// Monta o índice uma vez só por instância do servidor (leva uns
// milissegundos) e reaproveita nas próximas chamadas.
let index = null;
function getIndex() {
  if (!index) index = createCityIndex(rawCities, rawCountries);
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
