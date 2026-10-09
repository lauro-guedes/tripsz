/**
 * Categorias de torcedor (Meu Nível) — os nomes, as faixas de XP e os TEXTOS
 * ficam aqui, num arquivo só, pra dar pra ajustar o texto sem mexer nas telas.
 *
 * Os NOMES das categorias também aparecem no servidor (ranking, perfil público
 * e painel admin): se mudar um nome aqui, mude lá também.
 */
export const XP_TIERS = [
  { level: 1, name: "Torcedor de Sofá", min: 0, max: 499, icon: "sofa", perk: "Ponto de partida: registre seus primeiros jogos e estádios para começar a somar XP." },
  { level: 2, name: "Estreante", min: 500, max: 1499, icon: "mapPin", perk: "Os primeiros carimbos do passaporte: jogos registrados e as primeiras conquistas." },
  { level: 3, name: "Groundhopper", min: 1500, max: 4999, icon: "globe", perk: "Sempre atrás de estádios e países novos: seu perfil começa a aparecer no ranking." },
  { level: 4, name: "Veterano", min: 5000, max: 19999, icon: "trophy", perk: "Uma coleção de respeito: muitos jogos, vários países e conquistas raras." },
  { level: 5, name: "Lenda", min: 20000, max: Infinity, icon: "crown", perk: "O topo da arquibancada: a categoria mais alta do Football Passport." },
];

export function computeTier(xp) {
  return XP_TIERS.find((t) => xp >= t.min && xp <= t.max) || XP_TIERS[0];
}

/** Textos das telas que falam das categorias. */
export const FAN_LEVEL_TEXTS = {
  sectionTitle: "Categorias de Torcedor",
  pageIntro: "Sua jornada como caçador de estádios. Acumule XP para subir de categoria.",
  featureTitle: "Categorias de Torcedor",
  featureBody: "Suba de 'Torcedor de Sofá' até a lendária categoria 'Lenda'.",
};
