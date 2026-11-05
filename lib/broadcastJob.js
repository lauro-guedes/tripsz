/**
 * Onde assistir — ler o que está guardado e atualizar o que está velho (SÓ no servidor). A atualização é SOB DEMANDA (igual ao calendário):
 * quem abre uma tela com jogos recebe o que já está guardado e, se estiver velho, pede UMA rodada. Trava: uma consulta por vez; limite por dia;
 * freio se a chave estiver falhando. Tudo que o Gemini diz passa por `validateBroadcasts` antes de ser guardado.
 */
import { DEFAULT_MODEL, GeminiError, askGemini, buildPrompt } from "./broadcastGemini";
import { BATCH_SIZE, inWindow, isStale, parseModelJson, tierOf, validateBroadcasts } from "./broadcastRules";

const FX = "fixture_id, kickoff, status, league_name, league_country, home_team, away_team";
const DAY = 24 * 3600 * 1000;
const maxRunsPerDay = () => (Number(process.env.BROADCAST_MAX_RUNS_PER_DAY) > 0 ? Number(process.env.BROADCAST_MAX_RUNS_PER_DAY) : 60);

function must(res) {
  if (res.error) { const e = new Error("db"); e.cause = res.error; throw e; }
  return res;
}
const cleanIds = (ids) => [...new Set((ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 60);
const itemOf = (row) => ({ channels: row.channels, confirmedAt: row.confirmed_at });

/** O que está guardado dos jogos pedidos + quais deles valem a pena e estão velhos (no máximo uma leva). Não chama o Gemini. */
export async function readBroadcasts(supabase, ids, { now = Date.now() } = {}) {
  const list = cleanIds(ids);
  if (list.length === 0) return { items: {}, covered: [], stale: [] };
  const [fx, bc] = await Promise.all([supabase.from("fixtures_calendar").select(FX).in("fixture_id", list), supabase.from("fixture_broadcasts").select("fixture_id, channels, confirmed_at").in("fixture_id", list)]);
  must(fx); must(bc);
  const rec = new Map((bc.data || []).map((r) => [Number(r.fixture_id), r]));
  const items = {};
  for (const r of bc.data || []) items[r.fixture_id] = itemOf(r);
  const covered = (fx.data || []).filter((f) => tierOf(f) && inWindow(f, now));
  const stale = covered.filter((f) => isStale(f, rec.get(Number(f.fixture_id)), now)).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)).slice(0, BATCH_SIZE).map((f) => Number(f.fixture_id));
  return { items, covered: covered.map((f) => Number(f.fixture_id)), stale };
}

/** Pode consultar agora? "busy" (já tem uma rodando), "cap" (passou do limite do dia) ou "backoff" (as últimas falharam: não gasta mais cota). */
export async function checkGuards(supabase, now) {
  const { data } = must(await supabase.from("broadcast_runs").select("kind, started_at, finished_at, error").gte("started_at", new Date(now - DAY).toISOString()).order("started_at", { ascending: false }).limit(300));
  const runs = (data || []).filter((r) => r.kind === "user");
  if (runs.some((r) => !r.finished_at && now - new Date(r.started_at).getTime() < 3 * 60e3)) return "busy";
  if (runs.length >= maxRunsPerDay()) return "cap";
  const last3 = runs.slice(0, 3);
  if (last3.length === 3 && last3.every((r) => r.error) && now - new Date(last3[0].started_at).getTime() < 30 * 60e3) return "backoff";
  return null;
}

/**
 * Uma rodada: escolhe os jogos (os pedidos que valem e estão velhos; com `force`, todos os que valem), pergunta ao Gemini, valida e guarda.
 * `dryRun`: não guarda (teste do admin). `admin`: mostra os detalhes (pedido, resposta crua, fontes) e não passa pelas travas.
 */
export async function runRefresh(supabase, { ids, apiKey, model = DEFAULT_MODEL, now = Date.now(), force = false, dryRun = false, admin = false, fetchImpl } = {}) {
  if (!apiKey) return { ok: true, skipped: "sem_chave" };
  const list = cleanIds(ids);
  const [fx, bc] = await Promise.all([supabase.from("fixtures_calendar").select(FX).in("fixture_id", list), supabase.from("fixture_broadcasts").select("fixture_id, confirmed_at").in("fixture_id", list)]);
  must(fx); must(bc);
  const rec = new Map((bc.data || []).map((r) => [Number(r.fixture_id), r]));
  const wanted = (fx.data || []).filter((f) => tierOf(f) && inWindow(f, now) && (force || isStale(f, rec.get(Number(f.fixture_id)), now))).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  if (wanted.length === 0) return { ok: true, none: true };
  const batch = wanted.slice(0, BATCH_SIZE);
  if (!admin) {
    const guard = await checkGuards(supabase, now);
    if (guard) return { ok: true, [guard]: true };
  }
  const { data: run } = must(await supabase.from("broadcast_runs").insert({ kind: admin ? "test" : "user", started_at: new Date(now).toISOString(), asked: batch.length, model }).select("id").single());
  const finish = async (patch) => { await supabase.from("broadcast_runs").update({ finished_at: new Date().toISOString(), ...patch }).eq("id", run.id); };
  let answer;
  try {
    answer = await askGemini({ games: batch, apiKey, model, fetchImpl });
  } catch (e) {
    const kind = e instanceof GeminiError ? e.kind : "unknown";
    await finish({ error: kind });
    return { ok: false, error: "upstream", kind };
  }
  const parsed = parseModelJson(answer.text);
  const verdict = validateBroadcasts({ askedIds: batch.map((f) => f.fixture_id), parsed, sources: answer.sources });
  const when = new Date(now).toISOString();
  const kick = new Map(batch.map((f) => [Number(f.fixture_id), f.kickoff]));
  if (!dryRun && verdict.accepted.length) {
    const rows = verdict.accepted.map((a) => ({ fixture_id: a.fixtureId, channels: a.channels, source_hosts: verdict.sources.hosts.slice(0, 8), kickoff: kick.get(a.fixtureId), confirmed_at: when, source: "gemini" }));
    const up = await supabase.from("fixture_broadcasts").upsert(rows, { onConflict: "fixture_id" });
    if (up.error) { await finish({ error: "db", accepted: 0, rejected: verdict.rejected.length }); const e = new Error("db"); e.cause = up.error; throw e; }
  }
  await finish({ accepted: verdict.accepted.length, rejected: verdict.rejected.length });
  const items = {};
  for (const a of verdict.accepted) items[a.fixtureId] = { channels: a.channels, confirmedAt: when };
  const out = { ok: true, asked: batch.length, accepted: verdict.accepted.length, rejected: verdict.rejected, items, remaining: wanted.length - batch.length };
  if (admin) out.details = { model, prompt: buildPrompt(batch), text: String(answer.text).slice(0, 6000), sources: answer.sources, hosts: verdict.sources.hosts, trusted: verdict.sources.trusted, primary: verdict.sources.primary, news: verdict.sources.news, queries: answer.queries, ms: answer.ms, saved: !dryRun, unknown: verdict.accepted.flatMap((a) => a.unknown), games: batch.map((f) => ({ id: Number(f.fixture_id), label: `${f.home_team} x ${f.away_team}`, league: f.league_name, kickoff: f.kickoff })) };
  return out;
}

/** Os jogos que o teste do admin vai perguntar: os da faixa ("brasil" ou "europa") nos próximos `days` dias, até uma leva. */
export async function pickTestGames(supabase, { scope, days = 2, now = Date.now() }) {
  const to = new Date(now + Math.min(Math.max(days, 1), 10) * DAY).toISOString();
  const { data } = must(await supabase.from("fixtures_calendar").select(FX).gte("kickoff", new Date(now - 3 * 3600e3).toISOString()).lte("kickoff", to).order("kickoff", { ascending: true }).limit(1500));
  return (data || []).filter((f) => tierOf(f) === scope && inWindow(f, now)).slice(0, BATCH_SIZE).map((f) => Number(f.fixture_id));
}
