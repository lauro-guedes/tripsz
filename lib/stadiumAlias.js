import { searchKey } from "./searchKey";

/** Nomes oficiais x apelidos dos estádios brasileiros mais comuns. A 1ª entrada de cada linha é o nome exibido. */
const GROUPS = [
  ["Morumbi", "morumbi", "morumbis", "cicero pompeu de toledo", "estadio do morumbi", "paulo machado de carvalho"],
  ["Maracanã", "maracana", "mario filho", "jornalista mario filho"],
  ["Mineirão", "mineirao", "magalhaes pinto", "governador magalhaes pinto"],
  ["Mangueirão", "mangueirao", "edgar proenca", "olimpico do para"],
  ["Beira-Rio", "beira rio", "jose pinheiro borda"],
  ["Arena Corinthians", "neo quimica arena", "arena corinthians", "itaquerao", "arena itaquera"],
  ["Allianz Parque", "allianz parque", "palestra italia", "arena palmeiras"],
  ["Arena MRV", "arena mrv", "gigante de aco"],
  ["Castelão", "castelao", "placido castelo"],
  ["Fonte Nova", "fonte nova", "octavio mangabeira", "arena fonte nova"],
  ["Arena Pernambuco", "arena pernambuco", "arena de pernambuco"],
  ["Mané Garrincha", "mane garrincha", "nacional de brasilia", "estadio nacional mane garrincha"],
  ["Couto Pereira", "couto pereira", "major antonio couto pereira"],
  ["Ligga Arena", "ligga arena", "arena da baixada", "joaquim americo"],
  ["Arena do Grêmio", "arena do gremio", "gremio arena"],
  ["São Januário", "sao januario", "vasco da gama", "estadio sao januario"],
  ["Nilton Santos", "nilton santos", "engenhao", "engenhão"],
  ["Vila Belmiro", "vila belmiro", "urbano caldeira"],
  ["Pacaembu", "pacaembu", "paulo machado de carvalho pacaembu"],
];
const IDX = GROUPS.map(([label, ...keys]) => ({ label, keys: keys.map(searchKey) }));
// "Paulo Machado de Carvalho" é o nome oficial do Pacaembu e do Morumbi (apelido): só Pacaembu casa se citar "pacaembu".
const hit = (k, a) => k === a || (` ${k} `).includes(` ${a} `);

/** Identidade do estádio: o mesmo valor pra nomes oficiais e apelidos conhecidos. */
export function stadiumIdentity(name) {
  const k = searchKey(name);
  if (!k) return { key: "", label: name };
  if (hit(k, "pacaembu")) return { key: "pacaembu", label: "Pacaembu" };
  for (const g of IDX) if (g.keys.some((a) => a && hit(k, a))) return { key: searchKey(g.label), label: g.label };
  return { key: k, label: name };
}
