import { authUser } from "@/lib/serverAuth";
import { syncStoreSubscription } from "@/lib/storeSubs";

/** POST /api/subscribe/store-sync — o app chama logo após a compra/restauração para liberar o acesso sem esperar o webhook. */
export async function POST(request) {
  const user = await authUser(request);
  if (!user) return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
  try {
    return Response.json(await syncStoreSubscription(user.id));
  } catch (e) {
    console.error("Erro em /api/subscribe/store-sync:", e);
    return Response.json({ error: "Não foi possível confirmar a compra agora." }, { status: 500 });
  }
}
