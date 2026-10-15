/**
 * Google Agenda da consultoria (roteiroporestadios@gmail.com), via OAuth com
 * refresh token — fetch puro, sem dependência. Variáveis de ambiente:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   GOOGLE_CALENDAR_ID (opcional, padrão "primary")
 * Sem elas, tudo aqui vira no-op: o pagamento e o pedido nunca dependem da Agenda.
 */
const TZ = "America/Sao_Paulo";
const SLOT_MINUTES = 30;

export function calendarConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}
const calId = () => encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "primary");

let tokenCache = null;
async function accessToken() {
  if (tokenCache && tokenCache.exp > Date.now() + 60000) return tokenCache.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`Google OAuth: ${data.error_description || data.error || res.status}`);
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

function addMinutes(date, time, mins) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${date}T${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

/**
 * Cria o evento da consultoria (com link do Meet e o cliente convidado).
 * Idempotente: o ID do evento é derivado do pagamento, então repetir não duplica.
 */
export async function createConsultoriaEvent({ paymentId, date, time, clientEmail, clientName }) {
  if (!calendarConfigured() || !paymentId || !date || !time) return { skipped: true };
  const token = await accessToken();
  const t = time.slice(0, 5);
  const body = {
    id: `tz${String(paymentId).toLowerCase().replace(/[^0-9a-v]/g, "")}`,
    summary: `Consultoria Tripsz${clientName ? ` — ${clientName}` : ""}`,
    description: `Consultoria de roteiro (pagamento ${paymentId}).${clientEmail ? `\nCliente: ${clientEmail}` : ""}`,
    start: { dateTime: `${date}T${t}:00`, timeZone: TZ },
    end: { dateTime: addMinutes(date, t, SLOT_MINUTES), timeZone: TZ },
    attendees: clientEmail ? [{ email: clientEmail }] : [],
    conferenceData: { createRequest: { requestId: `tz-${paymentId}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    reminders: { useDefault: true },
  };
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId()}/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 409) return { ok: true, duplicate: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Calendar: ${data.error?.message || res.status}`);
  return { ok: true, eventId: data.id, meet: data.hangoutLink || null };
}

/** Horários ocupados na Agenda nesse dia (pra não oferecer um horário em que o Lauro já tem compromisso). */
export async function busyIntervals(date) {
  if (!calendarConfigured()) return [];
  const token = await accessToken();
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: `${date}T00:00:00-03:00`,
      timeMax: `${date}T23:59:59-03:00`,
      timeZone: TZ,
      items: [{ id: process.env.GOOGLE_CALENDAR_ID || "primary" }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google freeBusy: ${data.error?.message || res.status}`);
  const cal = Object.values(data.calendars || {})[0];
  return (cal?.busy || []).map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));
}
