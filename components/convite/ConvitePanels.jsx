"use client";
import { Clock, MailCheck, Ticket } from "lucide-react";
import { BORDER, MUTED, TEXT } from "../../lib/tokens";
import { Reassurance } from "./ConviteParts";
import { Card, Field, GoogleButton, LinkBtn, Message, Notice, OrDivider, PrimaryBtn, SecondaryBtn, smallText } from "./ConviteUi";

const set = (setForm, key) => (value) => setForm((f) => ({ ...f, [key]: value }));

/** Quem não tem conta: "Crie seu Passaporte". */
export function SignupPanel({ form, setForm, busy, msg, onGoogle, onSubmit, onSwitchToLogin }) {
  return (
    <>
      <Card>
        <p style={{ ...smallText(20, TEXT), fontWeight: 700 }}>Crie seu Passaporte</p>
        <p style={smallText(13)}>É grátis. Crie a conta para resgatar o convite e guardar esse jogo.</p>
        <GoogleButton onClick={onGoogle} disabled={busy} />
        <OrDivider />
        <Field label="Nome" value={form.name} onChange={set(setForm, "name")} autoComplete="name" />
        <Field label="E-mail" value={form.email} onChange={set(setForm, "email")} type="email" autoComplete="email" />
        <Field label="Senha" value={form.password} onChange={set(setForm, "password")} type="password" autoComplete="new-password" />
        <p style={smallText(11)}>Senha com 8 ou mais caracteres, maiúscula e minúscula.</p>
        <p style={smallText(11)}>
          Ao criar a conta, você aceita os <a href="/termos" style={{ color: "inherit" }}>Termos de uso</a> e a <a href="/privacidade" style={{ color: "inherit" }}>Política de privacidade</a> do tripsz.
        </p>
        <Message msg={msg} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PrimaryBtn onClick={onSubmit} disabled={busy}>{busy ? "Guardando..." : "Criar conta e guardar esse jogo"}</PrimaryBtn>
          <LinkBtn onClick={onSwitchToLogin}>Já tenho conta · Entrar</LinkBtn>
        </div>
      </Card>
      <Reassurance />
    </>
  );
}

/** Entrar numa conta que já existe. `used` = o convite já foi resgatado (o aviso explica). */
export function LoginPanel({ used, form, setForm, busy, msg, onGoogle, onSubmit, onForgot, onSwitchToSignup }) {
  return (
    <>
      <Card>
        {used ? (
          <Notice icon={<Ticket size={24} color={MUTED} />} title="Este convite já foi usado">
            O convite foi resgatado e o jogo já está na conta que o utilizou. Entre nessa conta para ver a partida; este link não cria outro registro.
          </Notice>
        ) : (
          <>
            <p style={{ ...smallText(20, TEXT), fontWeight: 700 }}>Entre na sua conta</p>
            <p style={smallText(13)}>Entre para guardar esse jogo no seu Passaporte.</p>
          </>
        )}
        <GoogleButton onClick={onGoogle} disabled={busy} />
        <OrDivider />
        <Field label="E-mail" value={form.email} onChange={set(setForm, "email")} type="email" autoComplete="email" />
        <Field label="Senha" value={form.password} onChange={set(setForm, "password")} type="password" autoComplete="current-password" />
        {used && <p style={smallText(11)}>Use o e-mail da conta que resgatou o convite.</p>}
        <Message msg={msg} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PrimaryBtn onClick={onSubmit} disabled={busy}>{busy ? "Entrando..." : used ? "Entrar e ver jogo" : "Entrar e guardar esse jogo"}</PrimaryBtn>
          <LinkBtn onClick={onForgot}>Esqueci minha senha</LinkBtn>
          {!used && <LinkBtn onClick={onSwitchToSignup}>Criar conta</LinkBtn>}
        </div>
      </Card>
      <Reassurance />
    </>
  );
}

/** Convite que venceu (ou foi trocado por um novo). */
export function ExpiredPanel({ inviterName, msg, onRequest, onSkip }) {
  return (
    <>
      <Card>
        <Notice tone="amber" icon={<Clock size={24} color="#b78103" />} title="Este convite expirou">
          Este link não pode mais guardar a partida no seu Passaporte. Peça um novo convite a {inviterName} ou crie sua conta sem este jogo.
        </Notice>
        <p style={{ ...smallText(15, TEXT), fontWeight: 700 }}>Continue do seu jeito</p>
        <p style={smallText(13)}>Um novo convite válido permite resgatar a partida. Sem ele, sua conta começa com o Passaporte vazio.</p>
        <div style={{ background: BORDER, height: 1 }} />
        <p style={smallText(12)}>Para pedir outro link, envie uma mensagem a {inviterName} pelo canal em que você recebeu este convite.</p>
        <Message msg={msg} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PrimaryBtn onClick={onRequest}>Solicitar novo convite a {inviterName}</PrimaryBtn>
          <SecondaryBtn onClick={onSkip}>Criar conta sem este jogo</SecondaryBtn>
        </div>
      </Card>
      <Reassurance />
    </>
  );
}

/** Painel simples com título, texto e até dois botões (convite próprio, já resgatado por você, link inexistente, erro...). */
export function InfoPanel({ title, text, msg, primary, secondary }) {
  return (
    <>
      <Card>
        <Notice icon={<Ticket size={24} color={MUTED} />} title={title}>{text}</Notice>
        <Message msg={msg} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {primary && <PrimaryBtn onClick={primary.onClick} disabled={primary.disabled}>{primary.label}</PrimaryBtn>}
          {secondary && <SecondaryBtn onClick={secondary.onClick}>{secondary.label}</SecondaryBtn>}
        </div>
      </Card>
      <Reassurance />
    </>
  );
}

/** Cadastro por e-mail que exige confirmação: o convite fica guardado e é resgatado no primeiro login. */
export function ConfirmEmailPanel({ email, onLogin }) {
  return (
    <>
      <Card>
        <Notice icon={<MailCheck size={24} color="#008a3a" />} title="Quase lá! Confirme seu e-mail">
          Enviamos um link de confirmação para {email}. Depois de confirmar e entrar, esse jogo entra no seu Passaporte automaticamente.
        </Notice>
        <SecondaryBtn onClick={onLogin}>Já confirmei · Entrar</SecondaryBtn>
      </Card>
      <Reassurance />
    </>
  );
}
