import { supabaseAdmin } from "@/lib/supabase";
import { authUser } from "@/lib/serverAuth";

async function mpFetch(path, options = {}) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

/**
 * POST /api/subscribe/cancel
 * Recebe { userId }. Cancela a assinatura ativa/pendente mais recente
 * do usuário no Mercado Pago e marca como "cancelled" no nosso banco.
 * Os dados do Passport continuam salvos — só o acesso fica pausado.
 */
export async function POST(request) {
  try {
    const user = await authUser(request);
    if (!user) {
      return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
    }
    const userId = user.id; // vem do token conferido, nunca do corpo da requisição

    const supabase = supabaseAdmin();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      return Response.json({ error: "Nenhuma assinatura ativa encontrada." }, { status: 404 });
    }

    await mpFetch(`/preapproval/${sub.mercadopago_preapproval_id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });

    await supabase.from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", sub.id);

    return Response.json({ ok: true });
  } catch (e) {
    console.error("Erro em /api/subscribe/cancel:", e);
    return Response.json({ error: e.message || "Não foi possível cancelar a assinatura." }, { status: 500 });
  }
}
