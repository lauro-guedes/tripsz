import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/serverAuth";
import { REPORT_REASONS } from "@/lib/social";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => Response.json(body, { status, headers: NO_STORE });
const REASON = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Moderação das denúncias da rede social.
 * GET  /api/admin/reports?status=open|done  — a fila (a mais antiga primeiro), com uma prévia do que foi denunciado.
 * POST /api/admin/reports { id, action }    — action: "dismiss" (descartar), "reviewed" (analisada) ou "remove" (tira o post/comentário do ar e marca como analisada).
 * Resolve TODAS as denúncias abertas da mesma coisa de uma vez.
 */
export async function GET(request) {
  if (!(await requireAdmin(request))) return json({ error: "Acesso não autorizado." }, 403);
  try {
    const supabase = supabaseAdmin();
    const done = new URL(request.url).searchParams.get("status") === "done";
    let q = supabase.from("reports").select("id, reporter_id, target_type, target_id, reason, details, status, created_at, reviewed_at");
    q = done ? q.neq("status", "open").order("reviewed_at", { ascending: false, nullsFirst: false }) : q.eq("status", "open").order("created_at", { ascending: true });
    const { data: rows, error } = await q.limit(100);
    if (error) throw error;
    const reports = rows || [];

    const postIds = [...new Set(reports.filter((r) => r.target_type === "post" && UUID.test(r.target_id)).map((r) => r.target_id))];
    const commentIds = [...new Set(reports.filter((r) => r.target_type === "comment" && UUID.test(r.target_id)).map((r) => r.target_id))];
    const handles = [...new Set(reports.filter((r) => r.target_type === "profile").map((r) => r.target_id))];
    const [posts, comments, profilesByHandle] = await Promise.all([
      postIds.length ? supabase.from("posts").select("id, author_id, body, photos, stadium_name, deleted_at").in("id", postIds) : { data: [] },
      commentIds.length ? supabase.from("post_comments").select("id, author_id, body, post_id, deleted_at").in("id", commentIds) : { data: [] },
      handles.length ? supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("username", handles) : { data: [] },
    ]);
    const authorIds = [...new Set([...(posts.data || []), ...(comments.data || [])].map((r) => r.author_id).concat(reports.map((r) => r.reporter_id)).filter(Boolean))];
    const { data: authors } = authorIds.length ? await supabase.from("profiles").select("user_id, username, display_name").in("user_id", authorIds) : { data: [] };
    const handleOf = new Map((authors || []).map((p) => [p.user_id, p.username]));
    const postOf = new Map((posts.data || []).map((p) => [p.id, p]));
    const commentOf = new Map((comments.data || []).map((c) => [c.id, c]));
    const profileOf = new Map((profilesByHandle.data || []).map((p) => [p.username, p]));

    // quantas denúncias abertas cada alvo tem
    const { data: openAll } = await supabase.from("reports").select("target_type, target_id").eq("status", "open").limit(5000);
    const openCount = new Map();
    for (const r of openAll || []) openCount.set(`${r.target_type}:${r.target_id}`, (openCount.get(`${r.target_type}:${r.target_id}`) || 0) + 1);

    const out = reports.map((r) => {
      let target = null;
      if (r.target_type === "post") {
        const p = postOf.get(r.target_id);
        if (p) target = { removed: !!p.deleted_at, author: handleOf.get(p.author_id) || null, text: p.body || "", photo: (p.photos && p.photos[0]) || null, stadium: p.stadium_name || null };
      } else if (r.target_type === "comment") {
        const c = commentOf.get(r.target_id);
        if (c) target = { removed: !!c.deleted_at, author: handleOf.get(c.author_id) || null, text: c.body || "" };
      } else {
        const p = profileOf.get(r.target_id);
        if (p) target = { removed: false, author: p.username, text: p.display_name || "", photo: p.avatar_url || null };
      }
      return {
        id: r.id,
        type: r.target_type,
        targetId: r.target_id,
        reason: REASON[r.reason] || r.reason,
        details: r.details || null,
        status: r.status,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
        reporter: handleOf.get(r.reporter_id) || null,
        openReports: openCount.get(`${r.target_type}:${r.target_id}`) || 0,
        target,
      };
    });
    return json({ reports: out, total: out.length });
  } catch (e) {
    console.error("[admin/reports]", e && e.message);
    return json({ error: "Não foi possível carregar as denúncias." }, 500);
  }
}

export async function POST(request) {
  if (!(await requireAdmin(request))) return json({ error: "Acesso não autorizado." }, 403);
  try {
    const { id, action } = await request.json();
    if (!UUID.test(String(id || "")) || !["dismiss", "reviewed", "remove"].includes(action)) return json({ error: "Dados inválidos." }, 400);
    const supabase = supabaseAdmin();
    const { data: rep, error } = await supabase.from("reports").select("id, target_type, target_id").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!rep) return json({ error: "Denúncia não encontrada." }, 404);
    const now = new Date().toISOString();
    if (action === "remove") {
      if (rep.target_type === "profile" || !UUID.test(rep.target_id)) return json({ error: "Perfis não são removidos por aqui. Use a tela de Usuários." }, 400);
      const table = rep.target_type === "post" ? "posts" : "post_comments";
      const { error: delErr } = await supabase.from(table).update({ deleted_at: now }).eq("id", rep.target_id);
      if (delErr) throw delErr;
    }
    const status = action === "dismiss" ? "dismissed" : "reviewed";
    const { error: upErr } = await supabase.from("reports").update({ status, reviewed_at: now }).eq("target_type", rep.target_type).eq("target_id", rep.target_id).eq("status", "open");
    if (upErr) throw upErr;
    return json({ ok: true, status });
  } catch (e) {
    console.error("[admin/reports]", e && e.message);
    return json({ error: "Não foi possível concluir agora." }, 500);
  }
}
