import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Grade fixa de disponibilidade, por dia da semana (0=domingo...6=sábado).
// Cada janela é [início, fim]; os horários dentro dela são gerados de
// 30 em 30 minutos.
const SCHEDULE = {
  1: [["08:30", "10:00"], ["20:00", "21:00"]], // segunda
  3: [["08:30", "10:00"], ["20:00", "21:00"]], // quarta
  5: [["08:30", "10:00"], ["20:00", "21:00"]], // sexta
  6: [["09:00", "12:00"]], // sábado
};
const SLOT_MINUTES = 30;

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function slotsForDate(dateStr) {
  // new Date("YYYY-MM-DD") é interpretado como UTC — usamos isso só pra
  // pegar o dia da semana, consistente independente do fuso do servidor.
  const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  const windows = SCHEDULE[dow] || [];
  const slots = [];
  windows.forEach(([start, end]) => {
    let cur = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    while (cur + SLOT_MINUTES <= endMin) {
      slots.push(minutesToTime(cur));
      cur += SLOT_MINUTES;
    }
  });
  return slots;
}

/**
 * GET /api/consultoria/availability?date=YYYY-MM-DD
 * Devolve os horários de consultoria daquele dia, com os já reservados
 * marcados como indisponíveis — sem gastar nada de cota de API
 * nenhuma, é só nossa própria grade fixa + nossa própria tabela.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Parâmetro date (YYYY-MM-DD) é obrigatório." }, { status: 400 });
  }

  try {
    const allSlots = slotsForDate(date);
    if (allSlots.length === 0) {
      return Response.json({ date, slots: [] });
    }

    const supabase = supabaseAdmin();
    const { data: booked } = await supabase
      .from("orders")
      .select("scheduled_time")
      .eq("item_type", "consultoria")
      .eq("scheduled_date", date)
      .in("status", ["paid", "pending"]);

    const bookedTimes = new Set((booked || []).map((o) => o.scheduled_time));

    return Response.json({
      date,
      slots: allSlots.map((time) => ({ time, available: !bookedTimes.has(time) })),
    });
  } catch (e) {
    console.error("Erro em /api/consultoria/availability:", e);
    return Response.json({ error: e.message || "Não foi possível carregar os horários." }, { status: 500 });
  }
}
