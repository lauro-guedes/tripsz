import { searchVenues } from "@/lib/footballApi";

function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Mesma lista de apelidos da rota principal — repetida aqui de propósito
// (é só um mapa pequeno) pra essa rota de sugestões não depender da
// outra e poder responder rapidinho, sem chamar a API-Football quando
// o apelido já é conhecido.
const STADIUM_NICKNAMES = [
  "Anfield", "Old Trafford", "San Siro", "Giuseppe Meazza", "Wanda Metropolitano",
  "Signal Iduna Park", "Westfalenstadion", "Mineirão", "Itaquerão", "Ali Sami Yen",
];

/**
 * GET /api/attended-games/search-stadium/suggest?q=min
 *
 * Autocomplete pra tela "Registrar Jogo" — devolve só nomes pra mostrar
 * num dropdown enquanto a pessoa digita, sem buscar os jogos ainda (isso
 * só acontece quando ela aperta "Buscar" de verdade, na rota principal).
 * Gasta 1 requisição da cota diária por chamada, então o app só chama
 * isso depois de parar de digitar por um tempinho (debounce no front).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 3) {
    return Response.json({ suggestions: [] });
  }

  const qNorm = stripDiacritics(q.toLowerCase());
  const nicknameMatches = STADIUM_NICKNAMES.filter((n) => stripDiacritics(n.toLowerCase()).includes(qNorm)).map((n) => ({
    name: n,
    city: null,
    country: null,
  }));

  let apiMatches = [];
  try {
    const venues = await searchVenues(stripDiacritics(q));
    apiMatches = (venues || []).slice(0, 6).map((v) => ({ name: v.name, city: v.city, country: v.country }));
  } catch (e) {
    console.error("Erro na busca de sugestões de estádio:", e.message);
  }

  // Junta apelido + resultado real da API, sem repetir nome igual.
  const seen = new Set();
  const suggestions = [...nicknameMatches, ...apiMatches].filter((s) => {
    const key = s.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);

  return Response.json({ suggestions });
}
