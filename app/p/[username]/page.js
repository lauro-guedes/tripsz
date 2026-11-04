import { cleanUsername } from "@/lib/social";
import { SITE_URL } from "@/lib/siteUrl";
import { passportStats, gamesByUsers, profileByUsername, publicProfile } from "@/lib/socialShared";
import { supabaseAdmin } from "@/lib/supabase";
import OpenInApp from "./OpenInApp";

export const dynamic = "force-dynamic";

const GREEN = "#00c853";
const BORDER = "#e2e8f0";
const TEXT = "#0f172a";
const MUTED = "#64748b";

/** O perfil que aparece pra QUEM NÃO TEM CONTA (o link do "Compartilhar perfil"): só o que é público. Perfil privado mostra só nome e foto. */
async function load(raw) {
  const username = cleanUsername(raw);
  if (!username) return null;
  try {
    const supabase = supabaseAdmin();
    const row = await profileByUsername(supabase, username);
    if (!row || !row.social_onboarded_at) return null;
    const profile = publicProfile(row);
    let stats = null;
    if (!profile.isPrivate) {
      const games = await gamesByUsers(supabase, [row.user_id]);
      const s = passportStats(games.get(row.user_id) || []);
      stats = { stadiums: s.stadiums, countries: s.countries, games: s.games };
    }
    return { profile, stats };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const data = await load(params.username);
  if (!data) return { title: "Perfil não encontrado | tripsz", robots: { index: false, follow: false } };
  const { profile } = data;
  const description = profile.isPrivate ? `Entre no tripsz para seguir ${profile.displayName}.` : profile.bio || `Veja os estádios e os jogos que ${profile.displayName} já viveu no tripsz.`;
  return {
    title: `${profile.displayName} (@${profile.username}) no tripsz`,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `${SITE_URL}/p/${profile.username}` },
    openGraph: { title: `${profile.displayName} no tripsz`, description, ...(profile.avatarUrl ? { images: [profile.avatarUrl] } : {}) },
  };
}

export default async function PublicSocialProfile({ params }) {
  const data = await load(params.username);
  if (!data) {
    return (
      <div style={{ background: "#f8fafc", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, sans-serif" }}>
        <p style={{ fontSize: 16, color: MUTED, textAlign: "center" }}>Esse perfil não existe ou o link está incorreto.</p>
      </div>
    );
  }
  const { profile, stats } = data;
  const where = [profile.city, profile.country].filter(Boolean).join(", ");
  const initials = profile.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const inside = `/conta/usuario/${profile.username}`;
  const btn = { display: "block", textAlign: "center", borderRadius: 12, padding: "14px 20px", fontWeight: 700, fontSize: 15, textDecoration: "none" };
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <OpenInApp path={inside} />
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "14px 16px", display: "flex", justifyContent: "center" }}>
        <a href="/" style={{ display: "inline-flex" }}><img src="/logo-tripsz.svg" alt="tripsz" width={106} height={30} /></a>
      </div>
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "28px 16px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.displayName} width={96} height={96} style={{ width: 96, height: 96, borderRadius: 48, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: 48, background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 30 }}>{initials}</div>
          )}
          <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: 0 }}>{profile.displayName}</h1>
          <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>@{profile.username}{where ? ` · ${where}` : ""}</p>
          {profile.isPrivate ? (
            <p style={{ fontSize: 14, color: MUTED, margin: "6px 0 0" }}>Este perfil é privado. Entre no tripsz para pedir para seguir.</p>
          ) : (
            <>
              {profile.bio && <p style={{ fontSize: 14, color: TEXT, margin: "4px 0 0", whiteSpace: "pre-line" }}>{profile.bio}</p>}
              {stats && (
                <div style={{ display: "flex", gap: 8, width: "100%", marginTop: 10 }}>
                  {[[stats.stadiums, "estádios"], [stats.countries, "países"], [stats.games, "jogos"]].map(([n, label]) => (
                    <div key={label} style={{ flex: 1, background: "#f1f5f9", borderRadius: 12, padding: "12px 4px" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: "#008a3a", margin: 0 }}>{n}</p>
                      <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a href={inside} style={{ ...btn, background: GREEN, color: "#fff" }}>Ver perfil e seguir no tripsz</a>
          <a href="/" style={{ ...btn, background: "#fff", color: TEXT, border: `1px solid ${BORDER}` }}>Criar minha conta grátis</a>
        </div>
        <p style={{ fontSize: 13, color: MUTED, textAlign: "center", margin: 0 }}>Registre os estádios que você já visitou e monte seu Passaporte de Estádios.</p>
      </div>
    </div>
  );
}
