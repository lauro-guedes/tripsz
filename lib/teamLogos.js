/**
 * Escudos de times — SÓ no servidor.
 *
 * Guardamos uma cópia de cada escudo no nosso próprio storage (bucket
 * "team-logos", arquivo <id do time>.png), porque o CDN da API-Football
 * às vezes falha. Esse arquivo também acha o escudo de um time pelo NOME,
 * pros jogos que ficaram sem escudo (ex: importados de CSV).
 */
import { supabaseAdmin } from "@/lib/supabase";

export const TEAM_LOGO_BUCKET_URL = "https://aswxlrabhyzblyliyvjn.supabase.co/storage/v1/object/public/team-logos";
const API_BASE = "https://v3.football.api-sports.io";

/** Garante que o escudo está no nosso storage e devolve o link nosso; se algo falhar, devolve o link original. */
export async function ensureLogoCached(teamId, originalUrl) {
  if (!teamId || !originalUrl) return originalUrl || null;
  const ourUrl = `${TEAM_LOGO_BUCKET_URL}/${teamId}.png`;
  try {
    const head = await fetch(ourUrl, { method: "HEAD" });
    if (head.ok) return ourUrl;
  } catch {
    // segue pro download
  }
  try {
    const res = await fetch(originalUrl);
    if (!res.ok) return originalUrl;
    const buffer = await res.arrayBuffer();
    const { error } = await supabaseAdmin().storage.from("team-logos").upload(`${teamId}.png`, buffer, { contentType: "image/png", upsert: true });
    return error ? originalUrl : ourUrl;
  } catch {
    return originalUrl;
  }
}

/**
 * Nomes que a pessoa digita (ou que vêm de outras fontes) e que a
 * API-Football escreve diferente. chave = nome normalizado; valor = nome
 * como a API escreve. Acrescente aqui quando aparecer um caso novo.
 */
const NAME_ALIASES = {
  olympiquedemarseille: "Marseille",
  olympiquemarseille: "Marseille",
};

/** "Operário-PR" -> "operariopr": sem acento, sem pontuação, sem espaço. */
export function nameKey(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** A API só busca por texto simples: usa a palavra mais longa do nome (mín. 3 letras). */
export function searchTermFor(name) {
  const words = (name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 3);
  if (words.length === 0) return null;
  return words.reduce((a, b) => (b.length > a.length ? b : a));
}

async function defaultFetchTeams(term) {
  const url = new URL(`${API_BASE}/teams`);
  url.searchParams.set("search", term);
  // Cache de uma semana do próprio Next: o mesmo termo não gasta outra chamada.
  const res = await fetch(url.toString(), { headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY }, next: { revalidate: 604800 } });
  const data = await res.json();
  const errors = data.errors && !Array.isArray(data.errors) ? data.errors : null;
  if (errors && Object.keys(errors).length > 0) throw new Error(JSON.stringify(errors));
  return data.response || [];
}

/**
 * Acha o escudo de um time pelo nome. REGRA DE OURO: só aceita nome
 * exatamente igual (ignorando acento/pontuação) e único. Na dúvida, não
 * devolve nada — um escudo trocado é pior do que só as iniciais.
 * Devolve { logo: link | null, apiError?: true }.
 */
export async function resolveTeamLogoByName(name, { fetchTeams = defaultFetchTeams, cacheLogo = ensureLogoCached } = {}) {
  const raw = (name || "").trim();
  if (raw.length < 3 || raw.length > 60) return { logo: null };
  const key = nameKey(raw);
  const canonical = NAME_ALIASES[key] || raw;
  const targetKey = nameKey(canonical);
  const term = searchTermFor(canonical);
  if (!term) return { logo: null };

  let teams;
  try {
    teams = await fetchTeams(term);
  } catch {
    return { logo: null, apiError: true };
  }
  const exact = teams.filter((t) => nameKey(t.team?.name) === targetKey);
  if (exact.length !== 1) return { logo: null };
  const { id, logo } = exact[0].team;
  if (!id || !logo) return { logo: null };
  return { logo: await cacheLogo(id, logo) };
}
