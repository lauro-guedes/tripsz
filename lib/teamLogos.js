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

/* ------------------------------------------------------------------
 * CACHE PERMANENTE de escudos (tabela `team_logos` + storage `team-logos`)
 *
 * Cada time é buscado uma vez só. Depois, o app lê o link pronto da
 * tabela e nunca mais vai à API. Quando não acha, também guarda o "não
 * achou" (por 7 dias) pra não repetir a busca a cada visita.
 * ------------------------------------------------------------------ */
const NOT_FOUND_RETRY_DAYS = 7;
const MIN_LOGO_BYTES = 800; // imagem de verdade tem mais que isso; "?" / pixel transparente é bem menor
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

/** Baixa o escudo pelo ID do CDN da API-Football e confere que é uma imagem de verdade. */
async function downloadValidLogo(teamId) {
  try {
    const res = await fetch(`https://media.api-sports.io/football/teams/${teamId}.png`);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const isPng = PNG_SIGNATURE.every((b, i) => buffer[i] === b);
    if (!isPng || buffer.length < MIN_LOGO_BYTES) return null;
    return buffer;
  } catch {
    return null;
  }
}

/** Grava o arquivo no storage (sobrescreve cópia ruim antiga) e devolve o link nosso. */
async function storeLogoFile(teamId, buffer) {
  const { error } = await supabaseAdmin().storage.from("team-logos").upload(`${teamId}.png`, buffer, { contentType: "image/png", upsert: true });
  if (error) return null;
  // ?v= força o navegador/CDN a largar uma cópia antiga ruim que estivesse guardada
  return `${TEAM_LOGO_BUCKET_URL}/${teamId}.png?v=${Math.floor(Date.now() / 1000)}`;
}

async function readCache(keys) {
  const { data } = await supabaseAdmin().from("team_logos").select("cache_key, logo_url, updated_at").in("cache_key", keys);
  return data || [];
}

async function writeCache(rows) {
  const stamp = new Date().toISOString();
  await supabaseAdmin().from("team_logos").upsert(rows.map((r) => ({ ...r, updated_at: stamp })), { onConflict: "cache_key" });
}

/**
 * Devolve o link do escudo de um time, usando o cache. `teamId` (se souber) é
 * o caminho mais barato; `name` é o plano B (gasta 1 chamada da API, uma vez).
 */
export async function getCachedTeamLogo({ teamId, name }) {
  const id = Number(teamId) || null;
  const nKey = nameKey(name);
  // Com ID, a chave é só a do ID (nomes parecidos não podem se misturar); sem ID, a do nome.
  const keys = id ? [`id:${id}`] : nKey ? [`name:${nKey}`] : [];
  if (keys.length === 0) return null;

  const cached = await readCache(keys);
  const hit = cached.find((r) => r.logo_url);
  if (hit) return hit.logo_url;
  const retryAfter = Date.now() - NOT_FOUND_RETRY_DAYS * 86400000;
  const recentMiss = cached.length === keys.length && cached.every((r) => new Date(r.updated_at).getTime() > retryAfter);
  if (recentMiss) return null;

  let logo = null;
  let foundId = id;
  if (id) {
    const buffer = await downloadValidLogo(id);
    if (buffer) logo = await storeLogoFile(id, buffer);
  }
  if (!logo && name) {
    const byName = await resolveTeamLogoByName(name, {
      cacheLogo: async (tid) => {
        const buffer = await downloadValidLogo(tid);
        return buffer ? storeLogoFile(tid, buffer) : null;
      },
    });
    if (byName.apiError) return null; // problema passageiro: não grava "não achou"
    if (byName.logo) {
      logo = byName.logo;
      const m = /\/(\d+)\.png/.exec(byName.logo);
      foundId = m ? Number(m[1]) : foundId;
    }
  }

  const rows = keys.map((k) => ({ cache_key: k, logo_url: logo, team_id: foundId }));
  if (logo && foundId && !keys.includes(`id:${foundId}`)) rows.push({ cache_key: `id:${foundId}`, logo_url: logo, team_id: foundId });
  await writeCache(rows);
  return logo;
}
