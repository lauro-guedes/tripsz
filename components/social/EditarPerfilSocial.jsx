"use client";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UsernameEditField } from "../conta/UsernameEditField";
import { Message, PrimaryBtn, SecondaryBtn, text } from "../convite/ConviteUi";
import { BIO_MAX, CITY_MAX, DISPLAY_NAME_MAX, PROFILE_KINDS, cleanDisplayName } from "../../lib/social";
import { getMyProfile, getProfile, listBlocked, saveMyProfile, unblockUser, updateUsername } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { AvatarPicker } from "./AvatarPicker";
import { DadosConta } from "./DadosConta";
import { Avatar, Chip, EmptyState, SmallBtn, SocialShell } from "./ui";
import { useMyId } from "./useMyId";

const field = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "13px 14px", fontSize: 15, fontFamily: FONT_DISPLAY, color: TEXT, background: "#fff", outline: "none" };
const label = { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 };
const Section = ({ title, children }) => (
  <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
    <p style={text(16, TEXT, { fontWeight: 700 })}>{title}</p>
    {children}
  </div>
);

/** Editar perfil: capa, foto, nome, @, bio, perfis, cidade, privacidade, bloqueados e o caminho pros dados da conta. */
export function EditarPerfilSocial({ onNavigate, onLogout }) {
  const userId = useMyId();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [visited, setVisited] = useState([]);
  const [taken, setTaken] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // trava imediata contra toque duplo
  const [msg, setMsg] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setMsg(null); };

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await getMyProfile();
      if (!alive) return;
      if (!r.ok) return setLoadError(r.message);
      const p = r.profile;
      setMe(p);
      setForm({ coverUrl: p.coverUrl, avatarUrl: p.avatarUrl, displayName: p.displayName, username: p.username, bio: p.bio || "", kinds: p.kinds, city: p.city || "", isPrivate: p.isPrivate });
      const [b, full] = await Promise.all([listBlocked(), getProfile(p.username)]);
      if (!alive) return;
      if (b.ok) setBlocked(b.blocked);
      if (full.ok && full.passport) setVisited(full.passport.stadiums.slice(0, 4).map((s) => s.name));
    })();
    return () => { alive = false; };
  }, []);

  const save = async () => {
    if (savingRef.current) return;
    if (cleanDisplayName(form.displayName).length < 2) return setMsg({ type: "error", text: "Informe um nome público de 2 a 40 caracteres." });
    savingRef.current = true;
    setSaving(true);
    setMsg(null);
    try {
      if (form.username !== me.username) {
        const u = await updateUsername(form.username);
        if (!u.ok) return setMsg({ type: "error", text: u.message });
      }
      const r = await saveMyProfile({ avatarUrl: form.avatarUrl, displayName: cleanDisplayName(form.displayName), bio: form.bio, kinds: form.kinds, city: form.city, isPrivate: form.isPrivate });
      if (!r.ok) return setMsg({ type: "error", text: r.message });
      setMe(r.profile);
      setMsg({ type: "success", text: "Perfil atualizado." });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const unblock = async (username) => {
    const r = await unblockUser(username);
    if (r.ok) setBlocked((list) => list.filter((b) => b.username !== username));
    else setMsg({ type: "error", text: r.message });
  };

  if (loadError || !form) return <SocialShell onNavigate={onNavigate} onLogout={onLogout}><EmptyState title={loadError ? "Não foi possível abrir" : "Carregando..."} body={loadError} /></SocialShell>;
  return (
    <SocialShell onNavigate={onNavigate} onLogout={onLogout}>
      <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div role="button" aria-label="Voltar ao perfil" onClick={() => onNavigate("perfil")} style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ArrowLeft size={20} color={TEXT} /></div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, color: TEXT, margin: 0 }}>Editar perfil</h1>
        </div>
        <Section title="Foto de perfil"><AvatarPicker value={form.avatarUrl} name={form.displayName} onChange={(avatarUrl) => set({ avatarUrl })} userId={userId} /></Section>
        <Section title="Seu usuário">
          <UsernameEditField value={form.username} original={me.username} onChange={(username) => set({ username })} onValidity={setTaken} fieldStyle={field} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={label}>Nome público</p>
            <input aria-label="Nome público" value={form.displayName} onChange={(e) => set({ displayName: e.target.value.slice(0, DISPLAY_NAME_MAX) })} style={field} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={label}>Cidade</p>
            <input aria-label="Cidade" value={form.city} onChange={(e) => set({ city: e.target.value.slice(0, CITY_MAX) })} placeholder="Ex.: São Paulo" style={field} />
          </div>
        </Section>
        <Section title="Sua bio">
          <textarea aria-label="Bio" value={form.bio} onChange={(e) => set({ bio: e.target.value.slice(0, BIO_MAX) })} rows={4} style={{ ...field, resize: "none" }} />
          <p style={{ ...text(12, MUTED), textAlign: "right" }}>{form.bio.length}/{BIO_MAX}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PROFILE_KINDS.map((k) => <Chip key={k} on={form.kinds.includes(k)} onClick={() => set({ kinds: form.kinds.includes(k) ? form.kinds.filter((x) => x !== k) : [...form.kinds, k] })}>{k}</Chip>)}
          </div>
        </Section>
        <Section title="Privacidade">
          <div role="switch" aria-checked={form.isPrivate} aria-label="Perfil privado" onClick={() => set({ isPrivate: !form.isPrivate })} style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
            <div style={{ width: 46, height: 28, borderRadius: 999, background: form.isPrivate ? GREEN : "#cbd5e1", position: "relative", flexShrink: 0 }}><div style={{ position: "absolute", top: 3, left: form.isPrivate ? 21 : 3, width: 22, height: 22, borderRadius: 999, background: "#fff", transition: "left .15s" }} /></div>
            <div><p style={text(15, TEXT, { fontWeight: 700 })}>Perfil privado</p><p style={text(12, MUTED)}>Quem quiser te seguir precisa da sua aprovação. Só quem te segue vê seus jogos e estádios.</p></div>
          </div>
        </Section>
        <Message msg={msg} />
        <PrimaryBtn onClick={save} disabled={saving || taken}>{saving ? "Salvando..." : "Salvar alterações"}</PrimaryBtn>
        <DadosConta />
        <Section title="Perfis bloqueados">
          {blocked.length === 0 ? <p style={text(13, MUTED)}>Você não bloqueou ninguém.</p> : blocked.map((b) => (
            <div key={b.username} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Avatar url={b.avatarUrl} name={b.displayName} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}><p style={text(14, TEXT, { fontWeight: 700 })}>{b.displayName}</p><p style={text(12, MUTED)}>@{b.username}</p></div>
              <SmallBtn kind="outline" onClick={() => unblock(b.username)} label={`Desbloquear @${b.username}`}>Desbloquear</SmallBtn>
            </div>
          ))}
        </Section>
        <SecondaryBtn onClick={() => onNavigate("perfil")}>Voltar ao perfil</SecondaryBtn>
        <div role="button" onClick={onLogout} style={{ border: "1px solid #fecaca", background: "#fff", borderRadius: 12, padding: "14px 16px", textAlign: "center", cursor: "pointer" }}><p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#dc2626", margin: 0 }}>Sair da conta</p></div>
      </div>
    </SocialShell>
  );
}
