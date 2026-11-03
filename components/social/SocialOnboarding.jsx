"use client";
import { ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
import { UsernameEditField } from "../conta/UsernameEditField";
import { Message, PrimaryBtn, text } from "../convite/ConviteUi";
import { BIO_MAX, DISPLAY_NAME_MAX, PROFILE_KINDS, cleanDisplayName } from "../../lib/social";
import { saveMyProfile, updateUsername } from "../../lib/socialClient";
import { BG, BORDER, FONT_DISPLAY, GREEN, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { AvatarPicker } from "./AvatarPicker";
import { MAX_W, Avatar, Chip } from "./ui";
import { useMyId } from "./useMyId";

const STEPS = [
  { title: "Foto de perfil", body: "Como os outros groundhoppers vão te reconhecer nos estádios." },
  { title: "Seu usuário", body: "Defina seu apelido único na rede e seu nome público para os check-ins." },
  { title: "Sua bio", body: "Conte um pouco sobre a sua paixão por viajar e ver futebol." },
];
const field = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: FONT_DISPLAY, color: TEXT, background: "#fff", outline: "none" };
const label = { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 };

/** Os 3 passos do perfil social: foto, usuário e bio. `me`: resposta de getMyProfile. */
export function SocialOnboarding({ me, onDone }) {
  const p = me.profile;
  const userId = useMyId();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ avatarUrl: p.avatarUrl || null, username: p.username, displayName: p.displayName || "", bio: p.bio || "", kinds: p.kinds || [] });
  const [taken, setTaken] = useState(false); // @ inválido/em uso: bloqueia o avanço
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // trava imediata contra toque duplo
  const [error, setError] = useState(null);
  const set = (patch) => setData((d) => ({ ...d, ...patch }));

  const nameOk = cleanDisplayName(data.displayName).length >= 2;
  const canNext = step === 1 ? !taken && nameOk : true;

  const finish = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      if (data.username !== p.username) {
        const u = await updateUsername(data.username);
        if (!u.ok) {
          setStep(1);
          return setError({ type: "error", text: u.message });
        }
      }
      const r = await saveMyProfile({ avatarUrl: data.avatarUrl, displayName: cleanDisplayName(data.displayName), bio: data.bio, kinds: data.kinds, onboarded: true });
      if (!r.ok) return setError({ type: "error", text: r.message });
      onDone();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const next = () => (step < 2 ? (setError(null), setStep(step + 1)) : finish());
  const shownName = cleanDisplayName(data.displayName) || p.displayName;

  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <div style={{ maxWidth: MAX_W, margin: "0 auto", padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div role="button" aria-label="Voltar" onClick={() => step > 0 && setStep(step - 1)} style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", visibility: step > 0 ? "visible" : "hidden" }}>
            <ArrowLeft size={20} color={TEXT} />
          </div>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: GREEN_DARK, background: "rgba(0,200,83,0.12)", borderRadius: 999, padding: "5px 12px", margin: 0, textTransform: "uppercase" }}>Passo {step + 1} de 3</p>
        </div>
        <div style={{ display: "flex", gap: 6 }} aria-hidden="true">
          {STEPS.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? GREEN : BORDER }} />)}
        </div>
        <div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, color: TEXT, margin: 0 }}>{STEPS[step].title}</h1>
          <p style={{ ...text(14, MUTED), marginTop: 6 }}>{STEPS[step].body}</p>
        </div>

        {step === 0 && <AvatarPicker value={data.avatarUrl} name={shownName} onChange={(avatarUrl) => set({ avatarUrl })} userId={userId} />}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <UsernameEditField value={data.username} original={p.username} onChange={(username) => set({ username })} onValidity={setTaken} fieldStyle={field} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={label}>Nome público</p>
              <input aria-label="Nome público" value={data.displayName} onChange={(e) => set({ displayName: e.target.value.slice(0, DISPLAY_NAME_MAX) })} placeholder="Como você quer aparecer" style={field} />
            </div>
            <div>
              <p style={{ ...label, marginBottom: 8 }}>Pré-visualização do perfil</p>
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar url={data.avatarUrl} name={shownName} size={44} />
                <div><p style={text(15, TEXT, { fontWeight: 700 })}>{shownName}</p><p style={text(12, MUTED)}>@{data.username}</p></div>
              </div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={label}>Escreva sua bio</p>
              <textarea aria-label="Bio" value={data.bio} onChange={(e) => set({ bio: e.target.value.slice(0, BIO_MAX) })} rows={4} placeholder="Ex.: apaixonado por futebol de raiz..." style={{ ...field, resize: "none" }} />
              <p style={{ ...text(12, MUTED), textAlign: "right" }}>{data.bio.length}/{BIO_MAX}</p>
            </div>
            <div>
              <p style={{ ...label, marginBottom: 8 }}>Selecione seu perfil</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PROFILE_KINDS.map((k) => <Chip key={k} on={data.kinds.includes(k)} onClick={() => set({ kinds: data.kinds.includes(k) ? data.kinds.filter((x) => x !== k) : [...data.kinds, k] })}>{k}</Chip>)}
              </div>
            </div>
            <div>
              <p style={{ ...label, marginBottom: 8 }}>Como seu card ficará</p>
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Avatar url={data.avatarUrl} name={shownName} size={40} />
                    <div><p style={text(14, TEXT, { fontWeight: 700 })}>{shownName}</p><p style={text(12, MUTED)}>@{data.username}</p></div>
                  </div>
                  {data.bio && <p style={text(12, MUTED)}>{data.bio.length > 90 ? `${data.bio.slice(0, 90)}...` : data.bio}</p>}
                </div>
              </div>
            </div>
          </div>
        )}
        <Message msg={error} />
        <PrimaryBtn onClick={next} disabled={!canNext || saving}>{saving ? "Salvando..." : step < 2 ? "Continuar" : "Concluir"}</PrimaryBtn>
      </div>
    </div>
  );
}
