import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAdminEmail(email) {
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.toLowerCase());
}

/**
 * GET /api/admin/consulting?email=admin@tripsz.com
 * Painel administrativo — pedidos de consultoria, direto da tabela
 * orders (item_type = "consultoria").
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!isAdminEmail(email)) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("item_type", "consultoria")
      .order("scheduled_date", { ascending: false });
    const allOrders = orders || [];

    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const usersById = new Map((userList?.users || []).map((u) => [u.id, u]));

    const rows = allOrders.map((o) => {
      const user = usersById.get(o.user_id);
      return {
        id: o.id,
        userName: user?.user_metadata?.name || "Sem nome",
        userEmail: user?.email || "—",
        scheduledDate: o.scheduled_date,
        scheduledTime: o.scheduled_time,
        status: o.status,
        amount: (o.amount_cents || 0) / 100,
        createdAt: o.created_at,
      };
    });

    const paid = allOrders.filter((o) => o.status === "paid");
    const totalRevenue = paid.reduce((sum, o) => sum + (o.amount_cents || 0), 0) / 100;

    return Response.json({
      orders: rows,
      totalOrders: allOrders.length,
      paidCount: paid.length,
      pendingCount: allOrders.filter((o) => o.status === "pending").length,
      totalRevenue,
    });
  } catch (e) {
    console.error("Erro em /api/admin/consulting:", e);
    return Response.json({ error: e.message || "Não foi possível carregar as consultorias." }, { status: 500 });
  }
}
