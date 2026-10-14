"use client";
import { FontImports } from "../ui/FontImports";
import { Loading } from "../ui/Loading";
import { useIsMobile } from "../ui/useIsMobile";
import { GameCard, InviterRow, PageHeading, Shell } from "./ConviteParts";
import { ConfirmEmailPanel, ExpiredPanel, InfoPanel, LoginPanel, SignupPanel } from "./ConvitePanels";
import { goTo, useConvite } from "./useConvite";

/** Página pública do convite (/convite/<código>): mostra o jogo e deixa criar a conta, entrar ou resgatar. */
export function ConvitePage({ code }) {
  const isMobile = useIsMobile();
  const { status, data, photo, session, mode, setMode, form, setForm, busy, msg, setMsg, confirmEmail, setConfirmEmail, load, finish, signup, login, google, forgot, requestNew } = useConvite(code);

  if (status !== "ready") {
    return (
      <Shell isMobile={isMobile}>
        <FontImports />
        {status === "loading" ? <Loading text="Abrindo o convite..." /> : <InfoPanel title="Não foi possível carregar o convite" text="Verifique sua conexão e tente de novo." primary={{ label: "Tentar de novo", onClick: load }} />}
      </Shell>
    );
  }

  const { state, game, inviter, viewer } = data;
  const loggedIn = !!session;

  if (state === "notfound") {
    return (
      <Shell isMobile={isMobile} onLogin={() => goTo("/")}>
        <FontImports />
        <PageHeading isMobile={isMobile} label="Passaporte de Estádios · Convite pessoal" title="Este link de convite não existe" subtitle="Confira se o endereço está completo ou peça um novo convite a quem enviou." />
        <div style={{ maxWidth: 520 }}>
          <InfoPanel title="Link não encontrado" text="Ele pode ter sido digitado errado ou cortado ao ser copiado." primary={{ label: "Conhecer o tripsz", onClick: () => goTo("/") }} />
        </div>
      </Shell>
    );
  }

  const name = inviter.firstName; // link existente: o servidor sempre manda quem convidou
  let panel;
  if (viewer && viewer.isInviter) {
    panel = <InfoPanel title="Este é o seu convite" text="Envie o link para quem foi com você. Você não pode resgatar o próprio convite." primary={{ label: "Voltar aos meus jogos", onClick: () => goTo("/conta/jogos") }} />;
  } else if (state === "valid") {
    if (confirmEmail) panel = <ConfirmEmailPanel email={confirmEmail} onLogin={() => { setConfirmEmail(null); setMode("login"); }} />;
    else if (loggedIn) {
      const had = viewer && viewer.alreadyHasGame;
      panel = <InfoPanel title="Guardar esse jogo" text={had ? "Você já tinha esse jogo no seu Passaporte. Vamos conferir e manter tudo no lugar." : "Um toque e esse jogo entra no Passaporte da sua conta."} msg={msg} primary={{ label: busy ? "Guardando..." : "Guardar no meu Passaporte", onClick: () => finish(), disabled: busy }} />;
    } else if (mode === "login") panel = <LoginPanel used={false} form={form} setForm={setForm} busy={busy} msg={msg} onGoogle={google} onSubmit={() => login(false)} onForgot={forgot} onSwitchToSignup={() => { setMode("signup"); setMsg(null); }} />;
    else panel = <SignupPanel form={form} setForm={setForm} busy={busy} msg={msg} onGoogle={google} onSubmit={signup} onSwitchToLogin={() => { setMode("login"); setMsg(null); }} />;
  } else if (state === "expired") {
    panel = <ExpiredPanel inviterName={name} msg={msg} onRequest={requestNew} onSkip={() => goTo("/criar-conta")} />;
  } else if (viewer && viewer.claimedByMe) {
    panel = <InfoPanel title="Você já resgatou este convite" text="O jogo já está no seu Passaporte." primary={{ label: "Ver no meu Passaporte", onClick: () => goTo("/conta/jogos") }} />;
  } else if (loggedIn) {
    panel = <InfoPanel title="Este convite já foi resgatado" text={`Ele foi usado por outra conta. Se esse jogo também é seu, peça um novo convite a ${name}.`} primary={{ label: "Ir para meus jogos", onClick: () => goTo("/conta/jogos") }} />;
  } else {
    panel = <LoginPanel used form={form} setForm={setForm} busy={busy} msg={msg} onGoogle={google} onSubmit={() => login(true)} onForgot={forgot} />;
  }

  const subtitle = state === "valid" ? "Vocês viveram esse jogo juntos. Agora ele pode ser a primeira lembrança do seu Passaporte." : "Uma lembrança compartilhada da arquibancada. Confira abaixo a situação do convite.";
  return (
    <Shell isMobile={isMobile} onLogin={loggedIn ? undefined : state === "valid" ? () => { setMode("login"); setConfirmEmail(null); } : () => goTo("/")}>
      <FontImports />
      <PageHeading isMobile={isMobile} label="Passaporte de Estádios · Convite pessoal" title={`${name} te convidou para o tripsz`} subtitle={subtitle} />
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 20 : 32, alignItems: "flex-start" }}>
        <div style={{ width: isMobile ? "100%" : 460, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <GameCard game={game} inviterName={name} state={state} photo={photo} isMobile={isMobile} />
          <InviterRow inviter={inviter} />
        </div>
        <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined, display: "flex", flexDirection: "column", gap: 16 }}>{panel}</div>
      </div>
    </Shell>
  );
}
