"use client";
import { ArrowLeft, Lock, MoreVertical } from "lucide-react";
import { useState } from "react";
import { Message, text } from "../convite/ConviteUi";
import { BORDER, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { ProfileMenu } from "./ProfileMenu";
import { SocialOnboarding } from "./SocialOnboarding";
import { Avatar, EmptyState, SmallBtn, SocialShell, Tabs } from "./ui";
import { useProfile } from "./useProfile";

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
/** "2025-10-14" -> "14 OUT 2025" */
export function journeyDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function Stat({ value, label }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: GREEN, margin: 0 }}>{value}</p>
      <p style={text(12, MUTED)}>{label}</p>
    </div>
  );
}

function Locked({ icon, title, body }) {
  return (
    <div style={{ margin: "16px 20px", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
      {icon}
      <p style={text(15, TEXT, { fontWeight: 700 })}>{title}</p>
      <p style={text(13, MUTED)}>{body}</p>
    </div>
  );
}

/**
 * Perfil social. Sem `username`: o MEU perfil (na primeira vez, passa pelos 4 passos do onboarding).
 * Com `username`: o perfil de outra pessoa (seguir, denunciar, bloquear).
 */
export function PerfilSocial({ username = null, onNavigate, onLogout, onBack }) {
  const p = useProfile(username);
  const [tab, setTab] = useState("posts");
  const [menu, setMenu] = useState(false);
  const s = p.state;

  if (s.status === "onboarding") return <SocialOnboarding me={s.me} onDone={() => p.reload()} />;

  let body;
  if (s.status === "loading") body = <EmptyState title="Carregando perfil..." />;
  else if (s.status === "error") {
    const gone = s.code === "not_found";
    body = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingBottom: 24 }}>
        <EmptyState title={gone ? "Perfil não encontrado" : "Não foi possível abrir o perfil"} body={gone ? "Esse perfil não existe ou não está disponível." : s.message} />
        {gone ? <SmallBtn kind="outline" onClick={onBack}>Voltar</SmallBtn> : <SmallBtn onClick={p.reload}>Tentar de novo</SmallBtn>}
      </div>
    );
  } else {
    const d = s.data;
    const pr = d.profile;
    const rel = d.relation.state;
    const self = rel === "self";
    const where = [pr.city, pr.country].filter(Boolean).join(", ");
    const action = self ? (
      <SmallBtn kind="outline" onClick={() => onNavigate("perfil-editar")}>Editar perfil</SmallBtn>
    ) : rel === "blocked" ? (
      <SmallBtn onClick={p.unblock} disabled={p.busy}>Desbloquear</SmallBtn>
    ) : rel === "following" ? (
      <SmallBtn kind="outline" onClick={p.unfollow} disabled={p.busy}>Seguindo</SmallBtn>
    ) : rel === "requested" ? (
      <SmallBtn kind="outline" onClick={p.unfollow} disabled={p.busy}>Solicitado</SmallBtn>
    ) : (
      <SmallBtn onClick={p.follow} disabled={p.busy}>Seguir</SmallBtn>
    );
    const counts = `${plural(d.counts.followers, "seguidor", "seguidores")} · ${d.counts.following} seguindo`;
    body = (
      <>
        <div style={{ position: "relative", height: 150, background: "linear-gradient(135deg,#0f172a,#14532d)", overflow: "hidden" }}>
          {pr.coverUrl && <img src={pr.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          {!self && (
            <>
              <div role="button" aria-label="Voltar" onClick={onBack} style={{ position: "absolute", top: 12, left: 12, width: 36, height: 36, borderRadius: 999, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ArrowLeft size={20} color="#fff" />
              </div>
              <div role="button" aria-label="Mais opções" onClick={() => setMenu(true)} style={{ position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: 999, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <MoreVertical size={20} color="#fff" />
              </div>
            </>
          )}
        </div>
        <div style={{ background: "#fff", padding: "0 20px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: -40 }}>
            <Avatar url={pr.avatarUrl} name={pr.displayName} size={80} ring />
            <div style={{ paddingBottom: 6 }}>{action}</div>
          </div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: TEXT, margin: "12px 0 0" }}>{pr.displayName}</h1>
          <p style={text(14, MUTED)}>@{pr.username}{where ? ` · ${where}` : ""}</p>
          {d.mutualCount > 0 && <p style={text(12, MUTED, { marginTop: 2 })}>🤝 {plural(d.mutualCount, "amigo", "amigos")} em comum</p>}
          {pr.bio && <p style={{ ...text(14, TEXT), marginTop: 10, whiteSpace: "pre-line" }}>{pr.bio}</p>}
          {pr.kinds.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {pr.kinds.map((k) => (
                <span key={k} style={{ border: `1px solid ${GREEN}`, borderRadius: 999, padding: "3px 10px", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 11, color: GREEN_DARK }}>{k}</span>
              ))}
            </div>
          )}
          {self ? (
            <p role="button" aria-label="Abrir amigos" onClick={() => onNavigate("amigos")} style={{ ...text(13, TEXT, { fontWeight: 600 }), marginTop: 12, cursor: "pointer" }}>{counts}</p>
          ) : (
            <p style={{ ...text(13, MUTED), marginTop: 12 }}>{counts}</p>
          )}
        </div>
        <Message msg={p.notice} />
        {rel === "blocked" && <Locked icon={null} title={`Você bloqueou @${pr.username}`} body="Desbloqueie para voltar a ver o perfil e seguir." />}
        {rel !== "blocked" && !d.canSeeContent && <Locked icon={<Lock size={28} color={MUTED} />} title="Este perfil é privado" body={rel === "requested" ? "Pedido enviado. Quando for aprovado, você verá os jogos e estádios." : "Siga para ver os jogos, estádios e publicações."} />}
        {d.canSeeContent && d.stats && (
          <>
            <div style={{ background: "#fff", display: "flex", padding: "4px 12px 16px", borderBottom: `1px solid ${BORDER}` }}>
              <Stat value={d.stats.stadiums} label="estádios" />
              <Stat value={d.stats.countries} label="países" />
              <Stat value={d.stats.games} label="jogos" />
              <Stat value={d.stats.competitions} label="ligas" />
            </div>
            <div role={self ? "button" : undefined} aria-label={self ? "Abrir conquistas" : undefined} onClick={self ? () => onNavigate("conquistas") : undefined} style={{ margin: "16px 20px", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 6, cursor: self ? "pointer" : "default" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13, color: TEXT, margin: 0, textTransform: "uppercase" }}>Passaporte de Estádios</p>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, margin: 0, textTransform: "uppercase" }}>Nível: {d.stats.level}</p>
              </div>
              <p style={text(13, MUTED)}>Jogos e estádios registrados no Passaporte</p>
            </div>
            <Tabs label="Seções do perfil" value={tab} onChange={setTab} tabs={[{ id: "posts", label: "Posts" }, { id: "checkins", label: "Check-ins" }, { id: "estadios", label: "Estádios" }, { id: "passaporte", label: "Passaporte" }]} />
            <div style={{ background: "#fff", minHeight: 160 }}>
              {(tab === "posts" || tab === "checkins") && <EmptyState title={self ? (tab === "posts" ? "Suas publicações vão aparecer aqui" : "Seus check-ins vão aparecer aqui") : "Nada por aqui ainda"} body={self ? "Em breve você poderá publicar fotos e fazer check-in nos estádios." : null} />}
              {tab === "estadios" &&
                (d.passport.stadiums.length === 0 ? (
                  <EmptyState title="Nenhum estádio registrado" />
                ) : (
                  d.passport.stadiums.map((st) => (
                    <div key={st.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={text(15, TEXT, { fontWeight: 700 })}>{st.name}</p>
                        {st.country && <p style={text(12, MUTED)}>{st.country}</p>}
                      </div>
                      <p style={text(13, GREEN_DARK, { fontWeight: 700 })}>{plural(st.visits, "visita", "visitas")}</p>
                    </div>
                  ))
                ))}
              {tab === "passaporte" &&
                (d.passport.journey.length === 0 ? (
                  <EmptyState title="A jornada começa no primeiro jogo" />
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <p style={text(16, TEXT, { fontWeight: 700 })}>{self ? "Minha Jornada" : "Jornada"}</p>
                    {d.passport.journey.map((j) => (
                      <div key={`${j.stadium}-${j.date}`} style={{ borderLeft: `2px solid ${GREEN}`, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 2 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, margin: 0 }}>{journeyDate(j.date)}</p>
                        <p style={text(15, TEXT, { fontWeight: 700 })}>{j.stadium}</p>
                        {j.game && <p style={text(12, MUTED)}>{j.game}</p>}
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </>
        )}
        {menu && <ProfileMenu username={pr.username} displayName={pr.displayName} onClose={() => setMenu(false)} onBlock={async () => { setMenu(false); await p.block(); }} />}
      </>
    );
  }

  return <SocialShell onNavigate={onNavigate} onLogout={onLogout}>{body}</SocialShell>;
}
