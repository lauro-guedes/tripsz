const GREEN = "#00c853";
const BG = "#f8fafc";
const BG_ALT = "#f1f5f9";
const BORDER = "#e2e8f0";
const TEXT = "#0f172a";
const BODY = "#334155";
const MUTED = "#64748b";

async function getProfile(slug) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  try {
    const res = await fetch(`${siteUrl}/api/public-profile/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.found ? data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const profile = await getProfile(params.slug);
  if (!profile) return { title: "Perfil não encontrado — tripsz" };
  return {
    title: `${profile.name} — Football Passport | tripsz`,
    description: `Nível ${profile.level} · ${profile.levelName} — ${profile.stadiums} estádios, ${profile.countries} países, ${profile.games} jogos assistidos.`,
    openGraph: {
      title: `${profile.name} — Football Passport`,
      description: `Nível ${profile.level} · ${profile.levelName} no tripsz`,
    },
  };
}

export default async function PublicProfilePage({ params }) {
  const profile = await getProfile(params.slug);

  if (!profile) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 16, color: MUTED }}>Esse perfil não existe ou o link está incorreto.</p>
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 16px" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 18, color: TEXT, margin: 0 }}>tripsz</p>
        </div>

        <div style={{ background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", gap: 20, alignItems: "center", textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, overflow: "hidden", background: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 28, color: "#fff", margin: 0 }}>
                {profile.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </p>
            )}
          </div>
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22, color: TEXT, margin: 0 }}>{profile.name}</p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: GREEN, margin: "4px 0 0" }}>Nível {profile.level} — {profile.levelName}</p>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>{profile.stadiums}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: 0 }}>Estádios</p>
            </div>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>{profile.countries}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: 0 }}>Países</p>
            </div>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>{profile.games}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: 0 }}>Jogos</p>
            </div>
          </div>
        </div>

        {profile.badges.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Badges conquistadas</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {profile.badges.map((b) => (
                <div key={b} style={{ background: "rgba(0,200,83,0.06)", border: `1px solid ${GREEN}`, borderRadius: 999, padding: "6px 12px" }}>
                  <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 12, color: GREEN, margin: 0 }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <a href="/" style={{ background: GREEN, borderRadius: 999, padding: "14px 24px", textAlign: "center", textDecoration: "none" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>Monte seu próprio roteiro no tripsz →</p>
        </a>
      </div>
    </div>
  );
}
