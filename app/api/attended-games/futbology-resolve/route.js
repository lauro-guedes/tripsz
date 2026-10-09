import { authUser } from "@/lib/serverAuth";
import { resolveRows } from "@/lib/futbologyResolve";

export const dynamic = "force-dynamic";
// Cada data é uma chamada à API-Football (alguns segundos); o navegador manda poucas linhas por vez.
export const maxDuration = 60;

const MAX_ROWS = 8;

/**
 * POST /api/attended-games/futbology-resolve
 * body: { rows: [{ rowId, date: "YYYY-MM-DD", text, homeScore, awayScore }] }
 * Reconhece cada linha do Futbology como um jogo real e devolve times, escudos,
 * estádio, cidade e país. Só pra quem está logado.
 */
export async function POST(request) {
  const user = await authUser(request);
  if (!user) return Response.json({ error: "Usuário não autenticado." }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, MAX_ROWS).map((r) => ({
    rowId: r.rowId,
    date: typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null,
    text: String(r.text || "").slice(0, 300),
    homeScore: r.homeScore,
    awayScore: r.awayScore,
  }));
  if (rows.length === 0) return Response.json({ results: [] });

  try {
    const results = await resolveRows(rows);
    return Response.json({ results });
  } catch (e) {
    console.error("Erro em /api/attended-games/futbology-resolve:", e);
    return Response.json({ error: "Não foi possível reconhecer os jogos agora." }, { status: 500 });
  }
}
