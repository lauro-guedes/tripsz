"use client";
import { CreditCard, History, UserPlus } from "lucide-react";
import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { Message, text } from "../convite/ConviteUi";
import { shareProfile } from "../../lib/profileShare";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { ConquistasTab } from "./ConquistasTab";
import { ProfileMenu } from "./ProfileMenu";
import { ProfilePosts } from "./ProfilePosts";
import { SocialOnboarding } from "./SocialOnboarding";
import { Avatar, EmptyState, ScreenHeader, SmallBtn, SocialShell, Tabs } from "./ui";
import { useProfile } from "./useProfile";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function Stat({ value, label }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: GREEN_DARK, margin: 0 }}>{value}</p>
      <p style={text(12, MUTED)}>{label}</p>
    </div>
  );
}

/** Número do cabeçalho do perfil (como numa rede de fotos): valor em cima, rótulo embaixo. */
function Count({ value, label, onClick }) {
  return (
    <div role={onClick ? "button" : undefined} aria-label={onClick ? `Abrir ${label}` : undefined} onClick={onClick} style={{ flex: 1, textAlign: "center", cursor: onClick ? "pointer" : "default" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: TEXT, margin: 0 }}>{value}</p>
      <p style={text(12, MUTED)}>{label}</p>
    </div>
  );
}

function Locked({ title, body }) {
  return (
    <div style={{ margin: "16px 16px", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
      <p style={text(15, TEXT, { fontWeight: 700 })}>{title}</p>
      <p style={text(13, MUTED)}>{body}</p>
    </div>
  );
}

/**
 * Perfil social. Sem `username`: o MEU perfil (na primeira vez, passa pelos 4 passos do onboarding), com o menu de
 * Conquistas, Histórico de jogos e Minha assinatura. Com `username`: o perfil de outra pessoa (seguir, denunciar, bloquear).
 */
export function PerfilSocial({ username = null, onNavigate, onLogout, onBack }) {
  const p = useProfile(username);
  const [tab, setTab] = useState("posts");
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState(null);
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
    const mutual = rel === "following" && d.relation.followsYou;
    const where = [pr.city, pr.country].filter(Boolean).join(", ");
    const share = async () => {
      const r = await shareProfile(pr.username, pr.displayName);
      if (r === "copied") setNote({ type: "success", text: "Link do perfil copiado." });
      else if (r === "failed") setNote({ type: "error", text: "Não foi possível compartilhar agora." });
    };
    const shareBtn = <SmallBtn kind="soft" onClick={share} label="Compartilhar perfil">Compartilhar perfil</SmallBtn>;
    const action = self ? (
      <>
        <SmallBtn kind="soft" onClick={() => onNavigate("perfil-editar")}>Editar perfil</SmallBtn>
        {shareBtn}
      </>
    ) : rel === "blocked" ? (
      <SmallBtn onClick={p.unblock} disabled={p.busy}>Desbloquear</SmallBtn>
    ) : rel === "following" ? (
      <>
        {mutual && <SmallBtn kind="soft">Amigos ✓</SmallBtn>}
        <SmallBtn kind="outline" onClick={p.unfollow} disabled={p.busy}>Seguindo</SmallBtn>
        {shareBtn}
      </>
    ) : rel === "requested" ? (
      <>
        <SmallBtn kind="outline" onClick={p.unfollow} disabled={p.busy}>Solicitado</SmallBtn>
        {shareBtn}
      </>
    ) : (
      <>
        <SmallBtn onClick={p.follow} disabled={p.busy}>Seguir</SmallBtn>
        {shareBtn}
      </>
    );
    const openFriends = self ? () => onNavigate("amigos") : undefined;
    body = (
      <>
        <ScreenHeader
          title={self ? "Meu perfil" : pr.displayName}
          onBack={self ? () => window.history.back() : onBack}
          right={!self ? <div role="button" aria-label="Mais opções" onClick={() => setMenu(true)} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "flex-end", cursor: "pointer" }}><MoreVertical size={22} color={TEXT} /></div> : null}
        />
        <div style={{ padding: "12px 16px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar url={pr.avatarUrl} name={pr.displayName} size={80} />
            <div style={{ flex: 1, display: "flex" }}>
              <Count value={d.counts.posts || 0} label="publicações" />
              <Count value={d.counts.followers} label="seguidores" onClick={openFriends} />
              <Count value={d.counts.following} label="seguindo" onClick={openFriends} />
            </div>
          </div>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: TEXT, margin: "12px 0 0" }}>{pr.displayName}</h2>
          <p style={text(13, MUTED)}>@{pr.username}{where ? ` · ${where}` : ""}</p>
          {d.mutualCount > 0 && <p style={text(12, GREEN_DARK, { marginTop: 2, fontWeight: 600 })}>{plural(d.mutualCount, "amigo", "amigos")} em comum</p>}
          {pr.bio && <p style={{ ...text(14, TEXT), marginTop: 8, whiteSpace: "pre-line" }}>{pr.bio}</p>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>{action}</div>
          {self && (
            <div role="button" aria-label="Adicionar amigo" onClick={() => onNavigate("amigos")} style={{ marginTop: 10, background: GREEN, borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
              <UserPlus size={20} color="#fff" />
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: "#fff", margin: 0 }}>Adicionar amigo</p>
            </div>
          )}
        </div>
        <div style={{ padding: "0 16px" }}><Message msg={note} /></div>
        <Message msg={p.notice} />
        {rel === "blocked" && <Locked title={`Você bloqueou @${pr.username}`} body="Desbloqueie para voltar a ver o perfil e seguir." />}
        {rel !== "blocked" && !d.canSeeContent && <Locked title="Este perfil é privado" body={rel === "requested" ? "Pedido enviado. Quando for aprovado, você verá os jogos e estádios." : "Siga para ver os jogos, estádios e publicações."} />}
        {d.canSeeContent && d.stats && (
          <>
            <div style={{ display: "flex", padding: "8px 12px 6px" }}>
              <Stat value={d.stats.stadiums} label="estádios" />
              <Stat value={d.stats.countries} label="países" />
              <Stat value={d.stats.games} label="jogos" />
              <Stat value={d.stats.competitions} label="ligas" />
            </div>
            {self && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 16px 14px" }}>
                {[[History, "Histórico de jogos", "jogos"], [CreditCard, "Minha assinatura", "assinatura"]].map(([Ic, label, to]) => (
                  <div key={to} role="button" aria-label={label} onClick={() => onNavigate(to)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 999, padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                    <Ic size={16} color={GREEN_DARK} />
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{label}</p>
                  </div>
                ))}
              </div>
            )}
            <div style={{ padding: "0 16px" }}>
              <Tabs label="Seções do perfil" value={tab} onChange={setTab} tabs={[{ id: "posts", label: "Publicações" }, { id: "checkins", label: "Check-ins" }, self ? { id: "conquistas", label: "Conquistas" } : { id: "estadios", label: "Estádios" }]} />
            </div>
            <div style={{ background: "#fff", minHeight: 160, margin: "0 0 0" }}>
              {(tab === "posts" || tab === "checkins") && <ProfilePosts key={`${pr.username}-${tab}`} username={pr.username} kind={tab === "posts" ? "post" : "checkin"} self={self} onNavigate={onNavigate} />}
              {tab === "conquistas" && self && <ConquistasTab onNavigate={onNavigate} />}
              {tab === "estadios" && !self &&
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
            </div>
          </>
        )}
        {menu && <ProfileMenu username={pr.username} displayName={pr.displayName} onClose={() => setMenu(false)} onBlock={async () => { setMenu(false); await p.block(); }} />}
      </>
    );
  }

  return <SocialShell onNavigate={onNavigate} onLogout={onLogout}>{body}</SocialShell>;
}
