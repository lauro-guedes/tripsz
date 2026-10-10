"use client";

export const EMPTY_TRIP = { countries: [], games: [], cities: [], stadiums: [], days: 0, itinerary: [], notes: [], stats: null };

// "2026-10-07" -> Date em horário local (evita o dia voltar 1 por causa do fuso)
export function parseISODate(s) {
  if (typeof s !== "string") return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function planToTrip(plan, fallbackCountries) {
  if (!plan) return EMPTY_TRIP;
  const games = (plan.selected || []).map((g) => ({
    id: g.id,
    home: g.home?.name || "",
    away: g.away?.name || "",
    homeLogo: g.home?.logo || null,
    awayLogo: g.away?.logo || null,
    city: g.venue?.city || "",
    stadium: g.venue?.name || g.venue?.city || "",
    country: g.country,
    date: parseISODate(g.matchDate),
    competition: g.competition?.name || "",
    // clássico (nome da rivalidade) quando existe; senão a competição
    tag: g.rivalry || g.competition?.name || "Jogo",
    rivalry: g.rivalry || null,
    favorite: !!g.favorite,
    approxLocation: !!g.approxLocation,
    insideDates: g.insideDates !== false,
  }));
  const countries = plan.countries?.length ? plan.countries : fallbackCountries || [];
  return {
    countries,
    games,
    cities: plan.cities || [],
    stadiums: plan.stadiums || [],
    days: plan.stats?.days || 0,
    itinerary: plan.itinerary || [],
    notes: plan.notes || [],
    stats: plan.stats || null,
  };
}

// A "foto" que vai pro banco: sem a lista completa de jogos possíveis (pesada,
// e as telas só usam o roteiro escolhido, o dia a dia e os avisos).
export function slimPlan(plan) {
  if (!plan) return null;
  const { possible, ...rest } = plan;
  return rest;
}

// Pede ao servidor o roteiro com jogos reais pras respostas do questionário.
export async function fetchPlan(answers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70000);
  try {
    const res = await fetch("/api/trip/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        countries: answers.countries,
        dateStart: answers.dateStart,
        dateEnd: answers.dateEnd,
        flexLevel: answers.flexLevel,
        favoriteTeams: answers.favoriteTeams || [],
        priority: answers.priority,
        pace: answers.pace,
        adults: answers.adults,
        kids: answers.kids,
        budget: answers.budget,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.plan) throw new Error(json?.message || "Não foi possível montar o roteiro agora.");
    return json.plan;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("A busca de jogos demorou demais. Tente de novo em instantes.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
