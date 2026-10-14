"use client";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../../lib/authFetch";
import { FINAL_INVITE_ERRORS, clearPendingInvite, redeemAndPrepareWelcome, redeemInviteCode, savePendingInvite } from "../../lib/pendingInvite";
import { navigate } from "../../lib/navigate";
import { supabaseBrowser } from "../../lib/supabase";
import { teamLabel } from "../../lib/textUtils";

const err = (text) => ({ type: "error", text });
const info = (text) => ({ type: "info", text });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const goTo = navigate;

/** Mensagens do Supabase em português. */
function authMessage(m = "") {
  if (/already registered|already been registered/i.test(m)) return "Este e-mail já tem conta. Toque em “Já tenho conta · Entrar”.";
  if (/invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (/password/i.test(m)) return "A senha precisa ter 8 ou mais caracteres, com maiúscula e minúscula.";
  return "Não foi possível concluir agora. Tente de novo.";
}

/**
 * Estado e ações da página pública do convite: carrega o convite, e cuida de cadastro, login, Google,
 * recuperar senha e do resgate. A tela em si fica em ConvitePage.jsx.
 */
export function useConvite(code) {
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [data, setData] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState("signup"); // signup | login
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmEmail, setConfirmEmail] = useState(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const supabase = supabaseBrowser();
      const { data: s } = await supabase.auth.getSession();
      setSession(s.session || null);
      const res = await authFetch(`/api/invites/${encodeURIComponent(code)}`);
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error("preview");
      setData(body);
      setForm((f) => ({ ...f, name: f.name || body.inviteeName || "" }));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [code]);
  useEffect(() => {
    load();
  }, [load]);

  // Foto real do estádio (a mesma busca do modal de detalhes); sem foto, a do projeto, sem legenda.
  const stadium = data && data.game && data.game.stadium;
  const city = data && data.game && data.game.city;
  useEffect(() => {
    if (!stadium) return;
    let alive = true;
    fetch(`/api/venues/photo?name=${encodeURIComponent(stadium)}&city=${encodeURIComponent(city || "")}`)
      .then((r) => r.json())
      .then((j) => alive && j && j.url && setPhoto(j.url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [stadium, city]);

  /** Resgata o convite pra pessoa logada e leva pra tela de boas-vindas (ou, em `viewOnly`, direto pros jogos). */
  const finish = async ({ viewOnly = false } = {}) => {
    setBusy(true);
    setMsg(null);
    const r = viewOnly ? await redeemInviteCode(code) : await redeemAndPrepareWelcome(code);
    if (r.ok) {
      clearPendingInvite();
      goTo(viewOnly ? "/conta/jogos" : "/conta/bem-vindo");
      return;
    }
    setBusy(false);
    if (FINAL_INVITE_ERRORS.includes(r.code)) clearPendingInvite();
    setMsg(err(r.message));
    if (r.code === "used" || r.code === "expired") load();
  };

  const signup = async () => {
    const name = form.name.trim().replace(/\s+/g, " ");
    const email = form.email.trim();
    if (name.length < 2) return setMsg(err("Informe seu nome."));
    if (!EMAIL.test(email)) return setMsg(err("Informe um e-mail válido."));
    if (form.password.length < 8 || !/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password)) return setMsg(err("A senha precisa ter 8 ou mais caracteres, com maiúscula e minúscula."));
    setBusy(true);
    setMsg(null);
    savePendingInvite(code); // se precisar confirmar o e-mail, o app resgata no primeiro login
    const [first, ...rest] = name.split(" ");
    const { data: d, error } = await supabaseBrowser().auth.signUp({ email, password: form.password, options: { data: { name, first_name: first, last_name: rest.join(" ") }, emailRedirectTo: window.location.origin } });
    if (error) {
      setBusy(false);
      return setMsg(err(authMessage(error.message)));
    }
    if (d.user && Array.isArray(d.user.identities) && d.user.identities.length === 0) {
      setBusy(false);
      return setMsg(err(authMessage("already registered")));
    }
    if (d.session) return finish();
    setBusy(false);
    setConfirmEmail(email);
  };

  const login = async (viewOnly) => {
    const email = form.email.trim();
    if (!EMAIL.test(email) || !form.password) return setMsg(err("Informe o e-mail e a senha."));
    setBusy(true);
    setMsg(null);
    savePendingInvite(code);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password: form.password });
    if (error) {
      setBusy(false);
      return setMsg(err(authMessage(error.message)));
    }
    return finish({ viewOnly });
  };

  const google = async () => {
    setBusy(true);
    setMsg(null);
    savePendingInvite(code); // o Google leva a pessoa pra fora do site; o app resgata quando ela voltar logada
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) {
      setBusy(false);
      setMsg(err("Não foi possível entrar com o Google agora."));
    }
  };

  const forgot = async () => {
    const email = form.email.trim();
    if (!EMAIL.test(email)) return setMsg(err("Digite seu e-mail acima para receber o link de nova senha."));
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` });
    setMsg(error ? err("Não foi possível enviar agora. Tente de novo.") : info("Enviamos um link para redefinir a senha. Confira seu e-mail."));
  };

  const requestNew = async () => {
    const g = data.game;
    const text = `Oi, ${data.inviter.firstName}! O convite do tripsz que você me mandou (${teamLabel(g.home_team)} × ${teamLabel(g.away_team)}) expirou. Pode me enviar um novo? ${window.location.origin}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMsg(info(`Mensagem copiada. Cole na conversa com ${data.inviter.firstName}.`));
    } catch {
      setMsg(err("Não foi possível copiar. Peça um novo convite pelo canal em que recebeu este."));
    }
  };

  return { status, data, photo, session, mode, setMode, form, setForm, busy, msg, setMsg, confirmEmail, setConfirmEmail, load, finish, signup, login, google, forgot, requestNew };
}
