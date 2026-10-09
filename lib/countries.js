/**
 * Nome de país: a API-Football escreve em inglês ("Brazil", "Italy") e a
 * gente (e quem digita) em português ("Brasil", "Itália"). Aqui os dois viram
 * a mesma chave, pra contar países e achar o continente sem duplicar.
 * England / Scotland / Wales continuam países separados (é assim no futebol).
 */

const strip = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

/** português (sem acento) -> inglês como a API escreve */
const PT_TO_EN = {
  brasil: "Brazil", inglaterra: "England", espanha: "Spain", italia: "Italy", alemanha: "Germany",
  franca: "France", holanda: "Netherlands", "paises baixos": "Netherlands", turquia: "Turkey", uruguai: "Uruguay",
  mexico: "Mexico", japao: "Japan", "estados unidos": "USA", eua: "USA", marrocos: "Morocco", croacia: "Croatia",
  servia: "Serbia", polonia: "Poland", belgica: "Belgium", suica: "Switzerland", austria: "Austria",
  dinamarca: "Denmark", suecia: "Sweden", noruega: "Norway", egito: "Egypt", "coreia do sul": "South Korea",
  russia: "Russia", grecia: "Greece", escocia: "Scotland", "pais de gales": "Wales", gales: "Wales",
  "irlanda do norte": "Northern Ireland", "republica tcheca": "Czech Republic", tchequia: "Czech Republic",
  ucrania: "Ukraine", irlanda: "Ireland", islandia: "Iceland", hungria: "Hungary", india: "India", canada: "Canada",
  paraguai: "Paraguay", bolivia: "Bolivia", equador: "Ecuador", panama: "Panama", mocambique: "Mozambique",
  australia: "Australia", "nova zelandia": "New Zealand", colombia: "Colombia", romenia: "Romania", bulgaria: "Bulgaria",
  eslovenia: "Slovenia", eslovaquia: "Slovakia", finlandia: "Finland", albania: "Albania", "africa do sul": "South Africa",
  "arabia saudita": "Saudi Arabia", china: "China", argelia: "Algeria", tunisia: "Tunisia", gana: "Ghana", nigeria: "Nigeria",
  cazaquistao: "Kazakhstan", azerbaijao: "Azerbaijan", georgia: "Georgia", armenia: "Armenia", chipre: "Cyprus",
  luxemburgo: "Luxembourg", montenegro: "Montenegro", macedonia: "North Macedonia", "macedonia do norte": "North Macedonia",
  bosnia: "Bosnia and Herzegovina", "bosnia e herzegovina": "Bosnia and Herzegovina", estonia: "Estonia", letonia: "Latvia",
  lituania: "Lithuania", bielorrussia: "Belarus", moldavia: "Moldova", malta: "Malta", kosovo: "Kosovo",
};

/** variações em inglês -> nome que a API usa */
const EN_SYNONYMS = {
  "united states": "USA", "united states of america": "USA", us: "USA", czechia: "Czech Republic", turkiye: "Turkey",
  holland: "Netherlands", "korea republic": "South Korea", "republic of ireland": "Ireland", "uk": "England",
};

const EUROPE = [
  "England", "Scotland", "Wales", "Northern Ireland", "Ireland", "Spain", "Italy", "Germany", "France", "Portugal", "Netherlands",
  "Turkey", "Belgium", "Switzerland", "Austria", "Denmark", "Sweden", "Norway", "Finland", "Iceland", "Poland", "Czech Republic",
  "Slovakia", "Hungary", "Romania", "Bulgaria", "Serbia", "Croatia", "Slovenia", "Bosnia and Herzegovina", "Montenegro",
  "North Macedonia", "Albania", "Kosovo", "Greece", "Cyprus", "Malta", "Luxembourg", "Ukraine", "Belarus", "Moldova", "Russia",
  "Estonia", "Latvia", "Lithuania", "Georgia", "Armenia", "Azerbaijan", "Andorra", "San Marino", "Liechtenstein", "Faroe Islands", "Gibraltar",
];
const SOUTH_AMERICA = ["Brazil", "Argentina", "Uruguay", "Chile", "Colombia", "Paraguay", "Peru", "Bolivia", "Ecuador", "Venezuela"];

const normalizedList = (list) => new Set(list.map((c) => strip(c)));
const EU_KEYS = normalizedList(EUROPE);
const SA_KEYS = normalizedList(SOUTH_AMERICA);

/** Chave única do país: "Brasil", "Brazil" e "brazil " dão a mesma. Vazio -> "". */
export function countryKey(name) {
  const k = strip(name);
  if (!k) return "";
  const en = PT_TO_EN[k] || EN_SYNONYMS[k] || k;
  return strip(en);
}

export const sameCountry = (a, b) => !!a && !!b && countryKey(a) === countryKey(b);

/** "eu" | "sa" | null */
export function continentOf(name) {
  const k = countryKey(name);
  if (EU_KEYS.has(k)) return "eu";
  if (SA_KEYS.has(k)) return "sa";
  return null;
}

/** Conta países diferentes (sem duplicar "Brasil" e "Brazil"). */
export function countDistinctCountries(names) {
  return new Set((names || []).map(countryKey).filter(Boolean)).size;
}

/** Nome em inglês como a API espera (ou o próprio texto se não conhece). */
export function toApiCountryName(name) {
  const k = strip(name);
  return PT_TO_EN[k] || EN_SYNONYMS[k] || (name || "");
}
