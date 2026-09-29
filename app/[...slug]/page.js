export const dynamic = "force-dynamic";

const GREEN = "#00c853";
const GREEN_BG = "rgba(0,200,83,0.06)";
const BG = "#f8fafc";
const BG_ALT = "#f1f5f9";
const GOLD = "#b78103";
const GOLD_BG = "#fff9e6";
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

function fmtDate(d) {
  if (!d) return null;
  const dd = new Date(d);
  if (isNaN(dd)) return null;
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${String(dd.getDate()).padStart(2, "0")} ${meses[dd.getMonth()]} ${dd.getFullYear()}`;
}

export async function generateMetadata({ params }) {
  const profile = await getProfile(params.slug);
  if (!profile) return { title: "Perfil não encontrado — tripsz" };
  return {
    title: `Football Passport de ${profile.name} | tripsz`,
    description: `Nível ${profile.level} · ${profile.levelName} — ${profile.stadiums} estádios, ${profile.countries} países, ${profile.games} jogos assistidos.`,
    openGraph: { title: `Football Passport de ${profile.name}`, description: `Nível ${profile.level} · ${profile.levelName} no tripsz` },
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

  const initials = profile.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px" }}>
        <p style={{ fontWeight: 800, fontSize: 18, color: TEXT, margin: 0 }}>tripsz</p>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="/" style={{ fontSize: 14, color: BODY, textDecoration: "none" }}>Entrar</a>
          <a href="/" style={{ background: GREEN, padding: "12px 24px", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Criar meu Football Passport</a>
        </div>
      </div>

      <div style={{ position: "relative", display: "flex", gap: 40, alignItems: "center", padding: "48px 40px", flexWrap: "wrap", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${BG_ALT}, ${BG})` }} />
        <div style={{ position: "relative", flex: "1 0 280px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>tripsz.com/u/{params.slug}</p>
          <p style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.1, color: TEXT, margin: 0 }}>Football Passport de {profile.name}</p>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 18, lineHeight: 1.5, color: BODY, margin: 0 }}>Confira os estádios visitados, jogos presenciados e conquistas desbloqueadas por este groundhopper.</p>
        </div>
        <div style={{ position: "relative", background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 16, padding: 28, width: 340, display: "flex", flexDirection: "column", gap: 20, boxShadow: "0px 12px 24px rgba(0,200,83,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, margin: 0 }}>FOOTBALL PASSPORT</p>
            <p style={{ color: GREEN, fontSize: 18, margin: 0 }}>🛡</p>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 72, height: 90, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden", flexShrink: 0, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <p style={{ color: "#fff", fontWeight: 700, fontSize: 22, margin: 0 }}>{initials}</p>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <p style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nome do Titular</p>
                <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, margin: 0 }}>{profile.name}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nível de Acesso</p>
                <p style={{ fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>Nível {profile.level} — {profile.levelName.toUpperCase()}</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <p style={{ color: MUTED, margin: 0 }}>ID: #{profile.shortId}</p>
            <p style={{ color: GOLD, fontWeight: 700, margin: 0 }}>ATIVAÇÃO: {profile.activationYear}</p>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", justifyContent: "space-around", padding: "40px 24px" }}>
        {[["Estádios Visitados", profile.stadiums], ["Países Conquistados", profile.countries], ["Jogos Assistidos", profile.games], ["Competições Diferentes", profile.competitions]].map(([label, value]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", minWidth: 140 }}>
            <p style={{ fontWeight: 700, fontSize: 36, color: GREEN, margin: 0 }}>{value}</p>
            <p style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ background: BG_ALT, padding: "48px 40px", display: "flex", flexDirection: "column", gap: 32 }}>
        <div>
          <div style={{ background: GOLD_BG, border: `1px solid ${GOLD}`, borderRadius: 4, padding: "6px 12px", display: "inline-block" }}>
            <p style={{ fontWeight: 700, fontSize: 11, color: GOLD, textTransform: "uppercase", margin: 0 }}>Galeria de Conquistas</p>
          </div>
          <p style={{ fontWeight: 700, fontSize: 28, color: TEXT, margin: "12px 0 0" }}>Badges de Viagem</p>
        </div>

        {profile.badgeCategories.length === 0 && (
          <p style={{ fontSize: 14, color: MUTED }}>Ainda sem conquistas desbloqueadas — assim que registrar os primeiros jogos, elas aparecem aqui.</p>
        )}

        {profile.badgeCategories.map((cat) => (
          <div key={cat.title} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ background: GREEN, width: 4, height: 28, borderRadius: 2 }} />
              <p style={{ fontWeight: 700, fontSize: 12, color: TEXT, textTransform: "uppercase", margin: 0 }}>{cat.title}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {cat.badges.map((b) => (
                <div key={b.label} style={{ background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ background: GREEN_BG, width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ color: GREEN, margin: 0 }}>🏆</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, margin: 0 }}>{b.label}</p>
                    {fmtDate(b.detail) && <p style={{ fontWeight: 700, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: "2px 0 0" }}>{fmtDate(b.detail)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, padding: "48px 40px 24px", display: "flex", flexDirection: "column", gap: 32 }}>
        <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>© {new Date().getFullYear()} tripsz. Todos os direitos reservados.</p>
      </div>
    </div>
  );
}
