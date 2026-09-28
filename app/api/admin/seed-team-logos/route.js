import { supabaseAdmin } from "@/lib/supabase";

// Mesma lista de IDs usada em TEAM_LOGO_IDS no TripszApp.jsx — mantenha
// as duas em sincronia se adicionar um time novo lá.
const TEAM_LOGO_IDS = {
  Arsenal: 42, Chelsea: 49, Liverpool: 40, "Manchester City": 50, Tottenham: 47,
  "Real Madrid": 541, Barcelona: 529, "Atlético Madrid": 530, Sevilla: 536,
  "Bayern München": 157, "Borussia Dortmund": 165, PSG: 85, Marseille: 81,
  Porto: 212, Benfica: 211, Ajax: 194, Feyenoord: 209, PSV: 197,
  Galatasaray: 645, Fenerbahçe: 611, "Boca Juniors": 451, "River Plate": 435,
  Flamengo: 127, Fluminense: 124, Corinthians: 131, Palmeiras: 121,
  Inter: 505, Milan: 489, Napoli: 492, Roma: 497, Lazio: 487,
  "AZ Alkmaar": 201, Bologna: 500, "Colo-Colo": 2315, Millonarios: 1125,
  Nacional: 2356, Newcastle: 34, "Peñarol": 2348, "Santa Fe": 1139, "Universidad de Chile": 2323,
};

/**
 * GET /api/admin/seed-team-logos?token=SEU_CRON_SECRET
 *
 * Uso único (ou re-rodar se quiser atualizar): baixa o escudo oficial de
 * cada time da lista fixa direto do CDN da API-Football e guarda uma
 * cópia nossa no Supabase Storage — assim o app não depende mais da
 * disponibilidade do CDN deles pra mostrar esses ~30 escudos.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (token !== process.env.CRON_SECRET) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const results = {};

  for (const [name, id] of Object.entries(TEAM_LOGO_IDS)) {
    try {
      const res = await fetch(`https://media.api-sports.io/football/teams/${id}.png`);
      if (!res.ok) {
        results[name] = `erro ao baixar (${res.status})`;
        continue;
      }
      const buffer = await res.arrayBuffer();
      const { error } = await supabase.storage
        .from("team-logos")
        .upload(`${id}.png`, buffer, { contentType: "image/png", upsert: true });
      results[name] = error ? `erro ao salvar: ${error.message}` : "ok";
    } catch (e) {
      results[name] = `erro: ${e.message}`;
    }
  }

  return Response.json({ results });
}
