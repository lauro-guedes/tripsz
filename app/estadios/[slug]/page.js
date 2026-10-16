import { notFound } from "next/navigation";
import { allStadiums, stadiumBySlug } from "../../../lib/stadiumPages";
import { wikiVenueInfo } from "../../../lib/venueWiki";
import { teamLabel } from "../../../lib/textUtils";
import { SITE_URL } from "../../../lib/siteUrl";
import { Shell } from "../Shell";
import { BODY, BORDER, GREEN, MUTED, TEXT } from "../../../lib/tokens";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

function fmt(iso) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function generateMetadata({ params }) {
  const s = await stadiumBySlug(params.slug);
  if (!s) return { title: "Estádio não encontrado", robots: { index: false, follow: false } };
  const where = [s.city, s.country].filter(Boolean).join(", ");
  const title = `${s.name}${where ? ` — ${where}` : ""}: jogos e roteiro`;
  const description = `${s.name}${s.homeTeam ? `, casa do ${teamLabel(s.homeTeam)}` : ""}${where ? ` em ${where}` : ""}${s.capacity ? `, com capacidade para ${s.capacity.toLocaleString("pt-BR")} pessoas` : ""}. Veja os próximos jogos e monte seu roteiro de futebol com a tripsz.`;
  return { title, description, alternates: { canonical: `/estadios/${s.slug}` }, openGraph: { title, description, url: `/estadios/${s.slug}`, type: "website" } };
}

export default async function Page({ params }) {
  const s = await stadiumBySlug(params.slug);
  if (!s) notFound();
  const info = await wikiVenueInfo(s.name, s.city).catch(() => null);
  const photo = info?.url || null;
  const capacity = s.capacity || info?.capacity || null;
  const where = [s.city, s.country].filter(Boolean).join(", ");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "StadiumOrArena",
    name: s.name,
    url: `${SITE_URL}/estadios/${s.slug}`,
    ...(photo ? { image: photo } : {}),
    ...(capacity ? { maximumAttendeeCapacity: capacity } : {}),
    address: { "@type": "PostalAddress", ...(s.city ? { addressLocality: s.city } : {}), ...(s.country ? { addressCountry: s.country } : {}) },
  };
  const next = s.games.slice(0, 20);
  return (
    <Shell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p style={{ fontSize: 13, margin: "0 0 12px" }}><a href="/estadios" style={{ color: MUTED }}>← Todos os estádios</a></p>
      <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: "0 0 8px" }}>{s.name}</h1>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.5, color: BODY, margin: "0 0 24px" }}>
        {where ? `${where}. ` : ""}
        {s.homeTeam ? `Casa do ${teamLabel(s.homeTeam)}. ` : ""}
        {capacity ? `Capacidade para ${capacity.toLocaleString("pt-BR")} pessoas.` : ""}
      </p>
      {photo && (
        <figure style={{ margin: "0 0 24px" }}>
          <img src={photo} alt={`${s.name}${where ? `, ${where}` : ""}`} style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 12, border: `1px solid ${BORDER}` }} />
          {info?.source && <figcaption style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>Foto: {info.page ? <a href={info.page} rel="nofollow noopener" style={{ color: MUTED }}>{info.source}</a> : info.source}</figcaption>}
        </figure>
      )}
      <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Próximos jogos no {s.name}</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {next.map((g) => (
          <li key={g.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 16px" }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: TEXT }}>{teamLabel(g.home)} x {teamLabel(g.away)}</span>
            <span style={{ display: "block", fontSize: 13, color: MUTED, marginTop: 2 }}>{g.league} · {fmt(g.kickoff)} (Brasília)</span>
          </li>
        ))}
      </ul>
      <div style={{ background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 16, padding: 24 }}>
        <p style={{ fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Quer ver um jogo no {s.name}?</p>
        <p style={{ color: BODY, margin: "0 0 16px", fontSize: 15, lineHeight: 1.5 }}>A tripsz cruza as partidas disponíveis e monta a melhor sequência de cidades para a sua viagem.</p>
        <a href="/" style={{ display: "inline-block", background: GREEN, color: "#fff", borderRadius: 8, padding: "12px 20px", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Montar meu roteiro</a>
      </div>
    </Shell>
  );
}
