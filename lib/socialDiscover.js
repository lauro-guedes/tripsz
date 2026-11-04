/**
 * tripsz.social — descobrir pessoas (SÓ no servidor): busca por nome ou @ e sugestões (amigos em comum e quem
 * visitou os mesmos estádios). Nunca devolve id, e-mail nem WhatsApp: só @, nome, foto e o motivo da sugestão.
 */
import { searchKey } from "./searchKey";
import { PROFILE_COLS, blockedEither, followGraph, miniProfile, must, profilesByIds } from "./socialShared";

const LIMIT = 20;
const SUGGEST_POOL = 3000;

/** Deixa só letras, números, espaço, ponto, sublinhado e hífen (o resto quebraria o filtro do banco). */
export function cleanQuery(raw) {
  return String(raw || "")
    .replace(/^[\s@]+/, "")
    .slice(0, 40)
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .trim();
}

const rowOf = (p, graph, extra = {}) => ({
  ...miniProfile(p),
  isPrivate: !!p.is_private,
  iFollow: graph.following.includes(p.user_id),
  requested: graph.requested.includes(p.user_id),
  ...extra,
});

/** Busca por nome ou @ (mínimo 2 letras). Só perfis que já concluíram o cadastro social. Fora: eu e quem tem bloqueio comigo. */
export async function searchPeople(supabase, viewer, qRaw) {
  const q = cleanQuery(qRaw);
  if (q.length < 2) return { ok: true, people: [], query: q };
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const [graph, block, found] = await Promise.all([
    followGraph(supabase, viewer.id),
    blockedEither(supabase, viewer.id),
    supabase.from("profiles").select(PROFILE_COLS).not("social_onboarded_at", "is", null).neq("user_id", viewer.id).or(`username.ilike.${like},display_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`).limit(60),
  ]);
  const { data } = must(found);
  const needle = searchKey(q);
  const rows = (data || [])
    .filter((p) => !block.byMe.has(p.user_id) && !block.me.has(p.user_id))
    .map((p) => ({ p, exact: p.username === q.toLowerCase() ? 0 : searchKey(p.username).startsWith(needle) ? 1 : 2 }))
    .sort((a, b) => a.exact - b.exact || a.p.username.localeCompare(b.p.username))
    .slice(0, LIMIT)
    .map(({ p }) => rowOf(p, graph));
  return { ok: true, people: rows, query: q };
}

/** Sugestões: quem os meus amigos seguem (mais amigos em comum primeiro) e quem já visitou os mesmos estádios que eu. */
export async function suggestPeople(supabase, viewer) {
  const [graph, block] = await Promise.all([followGraph(supabase, viewer.id), blockedEither(supabase, viewer.id)]);
  const skip = new Set([viewer.id, ...graph.following, ...graph.requested, ...block.byMe, ...block.me]);
  const score = new Map(); // id -> { common, stadium }

  if (graph.following.length) {
    const { data } = must(await supabase.from("follows").select("followee_id").in("follower_id", graph.following.slice(0, 500)).eq("status", "accepted").limit(SUGGEST_POOL));
    for (const r of data || []) {
      if (skip.has(r.followee_id)) continue;
      const s = score.get(r.followee_id) || { common: 0, stadium: null };
      s.common += 1;
      score.set(r.followee_id, s);
    }
  }
  const { data: mine } = must(await supabase.from("attended_games").select("stadium").eq("user_id", viewer.id).limit(500));
  const stadiums = [...new Set((mine || []).map((g) => g.stadium).filter(Boolean))].slice(0, 50);
  if (stadiums.length) {
    const { data } = must(await supabase.from("attended_games").select("user_id, stadium").in("stadium", stadiums).neq("user_id", viewer.id).limit(SUGGEST_POOL));
    for (const r of data || []) {
      if (skip.has(r.user_id)) continue;
      const s = score.get(r.user_id) || { common: 0, stadium: null };
      if (!s.stadium) s.stadium = r.stadium;
      score.set(r.user_id, s);
    }
  }
  const ranked = [...score.entries()].sort((a, b) => b[1].common - a[1].common || (b[1].stadium ? 1 : 0) - (a[1].stadium ? 1 : 0)).slice(0, LIMIT * 2).map(([id]) => id);
  const profiles = await profilesByIds(supabase, ranked);
  const people = [];
  for (const id of ranked) {
    const p = profiles.get(id);
    if (!p || !p.social_onboarded_at) continue;
    const s = score.get(id);
    const reason = s.common > 0 ? `${s.common} ${s.common === 1 ? "amigo em comum" : "amigos em comum"}` : !p.is_private && s.stadium ? `Também visitou ${s.stadium}` : "Visitou estádios em comum";
    people.push(rowOf(p, graph, { reason }));
    if (people.length === LIMIT) break;
  }
  return { ok: true, people };
}
