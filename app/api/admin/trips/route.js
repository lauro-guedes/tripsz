import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const PRIORITY_LABELS = {
  classics: "Clássicos",
  maxgames: "Máximo de jogos",
  stadiums: "Mais estádios",
};

/**
 * GET /api/admin/trips?email=admin@tripsz.com
 * Painel administrativo — roteiros criados, direto da tabela
 * trip_answers. O roteiro em si é sempre grátis, é só uma visão.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: trips } = await supabase
      .from("trip_answers")
      .select("*, orders(status)")
      .order("created_at", { ascending: false });
    const allTrips = trips || [];

    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const usersById = new Map((userList?.users || []).map((u) => [u.id, u]));

    const rows = allTrips.map((t) => {
      const user = usersById.get(t.user_id);
      const hasPaidConsulting = t.orders?.some((o) => o.status === "paid");
      return {
        id: t.id,
        userName: user?.user_metadata?.name || "Sem nome",
        userEmail: user?.email || "—",
        countries: t.countries || [],
        dateStart: t.date_start,
        dateEnd: t.date_end,
        priority: PRIORITY_LABELS[t.priority] || t.priority || "—",
        pace: t.pace,
        createdAt: t.created_at,
        hasPaidConsulting,
      };
    });

    return Response.json({
      trips: rows,
      total: rows.length,
      withConsulting: rows.filter((r) => r.hasPaidConsulting).length,
    });
  } catch (e) {
    console.error("Erro em /api/admin/trips:", e);
    return Response.json({ error: e.message || "Não foi possível carregar os roteiros." }, { status: 500 });
  }
}
