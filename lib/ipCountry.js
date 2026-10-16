/**
 * País de quem está acessando, pelo cabeçalho que a Vercel já manda (x-vercel-ip-country, código de 2 letras).
 * Só o PAÍS é usado — o IP não é guardado. Devolve o nome em português igual ao da lista do Meu Perfil, ou null.
 */
const ISO_TO_PT = {
  BR: "Brasil", DE: "Alemanha", AO: "Angola", AR: "Argentina", AU: "Austrália", AT: "Áustria", BE: "Bélgica", BO: "Bolívia",
  CA: "Canadá", CL: "Chile", CN: "China", CO: "Colômbia", KR: "Coreia do Sul", CR: "Costa Rica", HR: "Croácia", CU: "Cuba",
  DK: "Dinamarca", EG: "Egito", EC: "Equador", ES: "Espanha", US: "Estados Unidos", FR: "França", GR: "Grécia", NL: "Holanda",
  HU: "Hungria", IN: "Índia", IE: "Irlanda", IS: "Islândia", IT: "Itália", JP: "Japão", MX: "México", MA: "Marrocos",
  MZ: "Moçambique", NO: "Noruega", NZ: "Nova Zelândia", PA: "Panamá", PY: "Paraguai", PE: "Peru", PL: "Polônia", PT: "Portugal",
  GB: "Reino Unido", CZ: "República Tcheca", RU: "Rússia", SN: "Senegal", RS: "Sérvia", SE: "Suécia", CH: "Suíça", TR: "Turquia",
  UA: "Ucrânia", UY: "Uruguai", VE: "Venezuela",
};

export function countryNameFromIso(code) {
  return ISO_TO_PT[String(code || "").trim().toUpperCase()] || null;
}

export function countryFromRequest(request) {
  return countryNameFromIso(request.headers.get("x-vercel-ip-country"));
}
