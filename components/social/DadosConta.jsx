"use client";
import { useEffect, useState } from "react";
import { Message, PrimaryBtn, text } from "../convite/ConviteUi";
import { COUNTRY_LIST } from "../conta/MeuPerfil";
import { supabaseBrowser } from "../../lib/supabase";
import { BORDER, FONT_DISPLAY, MUTED, TEXT } from "../../lib/tokens";
import { Chip } from "./ui";

const field = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "13px 14px", fontSize: 15, fontFamily: FONT_DISPLAY, color: TEXT, background: "#fff", outline: "none" };
const label = { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 };
const PREFS = [
  ["derbies", "Derbies e clássicos"],
  ["estadios", "Estádios históricos"],
  ["grandes", "Ligas grandes"],
  ["alternativo", "Ligas menores"],
];

const Block = ({ title, children }) => (
  <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
    <p style={text(16, TEXT, { fontWeight: 700 })}>{title}</p>
    {children}
  </div>
);
const Field = ({ name, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><p style={label}>{name}</p>{children}</div>
);

/** Dados da conta dentro do Editar perfil (só no app): nome, e-mail, WhatsApp, país, times, preferências e senha. */
export function DadosConta({ tab = "conta" }) {
  const [orig, setOrig] = useState(null);
  const [f, setF] = useState(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [teamQuery, setTeamQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setMsg(null); };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabaseBrowser().auth.getUser();
      const u = data && data.user;
      if (!alive || !u) return;
      const m = u.user_metadata || {};
      const v = { name: m.name || "", email: u.email || "", whatsapp: m.whatsapp || "", country: m.country || "", teams: m.favorite_teams || [], prefs: m.preferences || [] };
      setOrig(v); setF(v);
      setHasPassword((u.identities || []).some((i) => i.provider === "email"));
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (teamQuery.trim().length < 3) return setSuggestions([]);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teams/suggest?q=${encodeURIComponent(teamQuery)}`);
        const d = await res.json();
        setSuggestions(d.suggestions || []);
      } catch { setSuggestions([]); }
    }, 500);
    return () => clearTimeout(t);
  }, [teamQuery]);

  if (!f) return null;

  const save = async () => {
    if (saving) return;
    if (pw.next || pw.confirm) {
      const err = hasPassword && !pw.current ? "Digite sua senha atual para definir uma nova senha."
        : pw.next.length < 8 ? "A nova senha precisa ter no mínimo 8 caracteres."
        : pw.next !== pw.confirm ? "As senhas não coincidem." : null;
      if (err) return setMsg({ type: "error", text: err });
    }
    setSaving(true);
    setMsg(null);
    try {
      const supabase = supabaseBrowser();
      if (pw.next && hasPassword) {
        const { error } = await supabase.auth.signInWithPassword({ email: orig.email, password: pw.current });
        if (error) throw new Error("Senha atual incorreta.");
      }
      const updates = { data: { name: f.name, whatsapp: f.whatsapp, country: f.country, favorite_teams: f.teams, preferences: f.prefs } };
      if (f.email !== orig.email) updates.email = f.email;
      if (pw.next) updates.password = pw.next;
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      setOrig(f);
      setPw({ current: "", next: "", confirm: "" });
      setMsg({ type: "success", text: f.email !== orig.email ? "Dados salvos. Confirme o novo e-mail pelo link que enviamos." : "Dados da conta atualizados." });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  };

  const wrap = (t) => ({ display: tab === t ? "flex" : "none", flexDirection: "column", gap: 16 });
  return (
    <>
      <div style={wrap("conta")}>
      <Block title="Dados da conta">
        <Field name="Nome completo"><input aria-label="Nome completo" value={f.name} onChange={(e) => set({ name: e.target.value.slice(0, 80) })} style={field} /></Field>
        <Field name="E-mail"><input aria-label="E-mail" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} style={field} /></Field>
        <Field name="WhatsApp"><input aria-label="WhatsApp" type="tel" value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value.slice(0, 30) })} style={field} /></Field>
        <Field name="País">
          <select aria-label="País" value={f.country} onChange={(e) => set({ country: e.target.value })} style={field}>
            <option value="">Selecione</option>
            {COUNTRY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </Block>
      <Block title="Segurança">
        {hasPassword && <Field name="Senha atual"><input aria-label="Senha atual" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => { setPw({ ...pw, current: e.target.value }); setMsg(null); }} style={field} /></Field>}
        <Field name="Nova senha"><input aria-label="Nova senha" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => { setPw({ ...pw, next: e.target.value }); setMsg(null); }} placeholder="Mínimo 8 caracteres" style={field} /></Field>
        <Field name="Confirmar nova senha"><input aria-label="Confirmar nova senha" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => { setPw({ ...pw, confirm: e.target.value }); setMsg(null); }} style={field} /></Field>
      </Block>
      </div>
      <div style={wrap("viagem")}>
      <Block title="Times favoritos">
        {f.teams.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {f.teams.map((t) => <Chip key={t} on onClick={() => set({ teams: f.teams.filter((x) => x !== t) })}>{t} ✕</Chip>)}
          </div>
        )}
        <input aria-label="Buscar time" value={teamQuery} onChange={(e) => setTeamQuery(e.target.value)} placeholder="Buscar time..." style={field} />
        {suggestions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${BORDER}`, borderRadius: 12 }}>
            {suggestions.slice(0, 6).map((s) => {
              const n = typeof s === "string" ? s : s.name || s.label;
              return <div key={n} role="button" onClick={() => { if (n && !f.teams.includes(n)) set({ teams: [...f.teams, n] }); setTeamQuery(""); setSuggestions([]); }} style={{ padding: "12px 14px", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}><p style={text(14, TEXT)}>{n}</p></div>;
            })}
          </div>
        )}
      </Block>
      <Block title="Preferências de viagem">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PREFS.map(([id, name]) => <Chip key={id} on={f.prefs.includes(id)} onClick={() => set({ prefs: f.prefs.includes(id) ? f.prefs.filter((x) => x !== id) : [...f.prefs, id] })}>{name}</Chip>)}
        </div>
      </Block>
      </div>
      {(tab === "conta" || tab === "viagem") && (
        <>
          <Message msg={msg} />
          <PrimaryBtn onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</PrimaryBtn>
        </>
      )}
    </>
  );
}
