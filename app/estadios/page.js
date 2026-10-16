import { allStadiums } from "../../lib/stadiumPages";
import { Shell } from "./Shell";
import { BODY, BORDER, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";

export const revalidate = 3600;

export const metadata = {
  title: "Estádios de futebol com jogos marcados",
  description: "Estádios de futebol na Europa e na América do Sul com jogos marcados: capacidade, cidade e próximos jogos. Monte seu roteiro de futebol com a tripsz.",
  alternates: { canonical: "/estadios" },
};

export default async function Page() {
  const stadiums = await allStadiums();
  const byCountry = new Map();
  for (const s of stadiums) {
    const k = s.country || "Outros";
    if (!byCountry.has(k)) byCountry.set(k, []);
    byCountry.get(k).push(s);
  }
  return (
    <Shell>
      <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: "0 0 12px" }}>Estádios com jogos marcados</h1>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.5, color: BODY, margin: "0 0 32px" }}>
        Escolha um estádio para ver a cidade, a capacidade e os próximos jogos, e monte seu roteiro de futebol com a tripsz.
      </p>
      {stadiums.length === 0 && <p style={{ color: MUTED }}>Os estádios aparecem aqui assim que o calendário de jogos for carregado.</p>}
      {[...byCountry.entries()].map(([country, list]) => (
        <section key={country} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>{country}</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {list.map((s) => (
              <li key={s.slug}>
                <a href={`/estadios/${s.slug}`} style={{ display: "block", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, textDecoration: "none" }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: TEXT }}>{s.name}</span>
                  <span style={{ display: "block", fontSize: 13, color: MUTED, marginTop: 4 }}>{[s.city, s.capacity ? `${s.capacity.toLocaleString("pt-BR")} lugares` : null].filter(Boolean).join(" · ")}</span>
                  <span style={{ display: "block", fontSize: 12, color: GREEN_DARK, marginTop: 8 }}>{s.games.length} {s.games.length === 1 ? "jogo marcado" : "jogos marcados"}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Shell>
  );
}
