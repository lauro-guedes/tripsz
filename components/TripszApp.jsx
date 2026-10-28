/**
 * tripsz — full flow, implemented from Figma nodes:
 * 91:2 (landing), 95:489 (criar conta), 95:419 (destino), 95:546 (datas),
 * 95:606 (pessoas+orçamento), 95:681 (preferências), 95:746 (loading),
 * 95:769 (resultado bloqueado), 95:877 (checkout), 95:982 (desbloqueado).
 *
 * Business model note: this flow prices differently from the earlier
 * dark "Matchday Planner" prototype — here it's a FIXED R$ 49,90 to
 * unlock the crossed fixtures/route, with human consultancy offered
 * as a separate, unpriced-in-app upsell (not bundled).
 *
 * Icons: real path data reused where you'd uploaded the SVG (arrow-right,
 * circle-x, lock-keyhole); everything else in this flow (globe, check,
 * calendar, alert-triangle, shield, info, credit-card, lock, lightbulb)
 * uses lucide-react, since those specific files weren't uploaded.
 */
"use client";
import { useState, useMemo, useEffect } from "react";
import { supabaseBrowser } from "../lib/supabase";
import { buildOptions } from "../lib/tripOptions";
import { FontImports } from "./ui/FontImports";
import { CriarConta } from "./auth/CriarConta";
import { LoginModal } from "./auth/LoginModal";
import { StepAccount } from "./auth/StepAccount";
import { LandingPage } from "./landing/LandingPage";
import { Onboarding } from "./app/Onboarding";
import { BottomTabBar, TAB_SCREENS } from "./app/BottomTabBar";
import { CheckinPopup } from "./app/CheckinPopup";
import { AchievementWatcher } from "./conquistas/AchievementUnlock";
import { isNativeApp } from "../lib/nativeApp";
import { LoadingScreen } from "./wizard/LoadingScreen";
import { StepDatas } from "./wizard/StepDatas";
import { StepDestino } from "./wizard/StepDestino";
import { StepPessoasOrcamento } from "./wizard/StepPessoasOrcamento";
import { StepPreferencias } from "./wizard/StepPreferencias";
import { StepTimesFavoritos } from "./wizard/StepTimesFavoritos";
import { MeusRoteiros } from "./roteiro/MeusRoteiros";
import { ResultadoRoteiro, RoteiroDetalhe } from "./roteiro/RoteiroView";
import { fetchPlan, planToTrip, slimPlan } from "../lib/tripPlanClient";
import { Checkout } from "./checkout/Checkout";
import { AssinarStandalone } from "./conta/AssinarStandalone";
import { MeuNivel } from "./conta/MeuNivel";
import { MeuPerfil } from "./conta/MeuPerfil";
import { Notificacoes } from "./conta/Notificacoes";
import { MinhaAssinatura } from "./conta/MinhaAssinatura";
import { MinhasConquistas } from "./conta/MinhasConquistas";
import { RankingTorcedores } from "./conta/Ranking";
import { BuscarJogos } from "./jogos/BuscarJogos";
import { MeuCalendario } from "./jogos/MeuCalendario";
import { MeusJogosHistorico } from "./jogos/MeusJogosHistorico";
import { RegistrarJogo } from "./jogos/RegistrarJogo";
import { PATH_TO_SCREEN, SCREEN_TO_PATH } from "./routes";
import { BoasVindasConvite } from "./conta/BoasVindasConvite";
import { JogoSalvo } from "./jogos/acompanhantes/JogoSalvo";
import { QuemFoiComVoce } from "./jogos/acompanhantes/QuemFoiComVoce";
import { saveDraft } from "../lib/companionDraft";
import { FINAL_INVITE_ERRORS, clearPendingInvite, readPendingInvite, redeemAndPrepareWelcome } from "../lib/pendingInvite";


export default function App() {
  // Remove a tela de carregamento estática (do layout.js) assim que o
  // app de verdade termina de montar — é o sinal de que já passamos do
  // momento "tela branca" que a demora de ~7s deixava aparecer.
  // No app (Capacitor) a landing é trocada pela apresentação; por isso só descobrimos isso aqui, depois de
  // montar (o servidor sempre entrega a landing do site). Dentro do app o loader fica até saber se há sessão.
  const [native, setNative] = useState(null);
  const removeLoader = () => document.getElementById("app-shell-loader")?.remove();
  useEffect(() => {
    const n = isNativeApp();
    setNative(n);
    if (!n) removeLoader();
  }, []);

  const [screen, setScreen] = useState("landing");
  const [showGlobalLoginModal, setShowGlobalLoginModal] = useState(false);
  // Quando a pessoa já está logada e começa um roteiro novo, ela pula a
  // tela de Criar Conta — então a numeração dos passos precisa "adiantar"
  // 1 casa (Destino vira Passo 1 em vez de Passo 2, e por aí vai).
  const [stepOffset, setStepOffset] = useState(0);
  // Pra onde ir depois de logar: "destino" se a pessoa clicou em "Montar
  // minha viagem" (quer começar um roteiro novo), ou "roteiros" se clicou
  // em "Entrar" (só quer acessar a conta que já tem). Precisa ser guardado
  // no localStorage, não só em memória — o login com Google recarrega a
  // página inteira (sai do site, vai pro Google, volta), e qualquer coisa
  // guardada só em memória (como um useRef) se perderia nesse meio-tempo.
  const setPostLoginTarget = (target) => localStorage.setItem("tripsz_post_login_target", target);
  // Devolve null se não tiver nenhuma intenção salva — importante não
  // inventar um destino padrão aqui, senão qualquer aviso do Supabase de
  // que já existe uma sessão (o que acontece toda vez que a pessoa volta
  // ao site já logada, não só depois de um login de verdade) empurraria
  // ela pro questionário sem que ela tivesse pedido isso.
  const readAndClearPostLoginTarget = () => {
    const target = localStorage.getItem("tripsz_post_login_target");
    localStorage.removeItem("tripsz_post_login_target");
    return target;
  };
  const [answers, setAnswers] = useState({});
  // Trava que impede o efeito "tela → URL" de rodar antes do efeito de
  // restauração inicial ler a URL original — sem isso, a primeira
  // renderização (screen="landing" por padrão) reescreveria qualquer link
  // direto (ex: /roteiro/destino) para "/" antes de conseguirmos lê-lo.
  const [initialized, setInitialized] = useState(false);
  const [plan, setPlan] = useState(null); // plano real (jogos de verdade) da tela aberta
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const trip = useMemo(() => planToTrip(plan, answers.countries), [plan, answers.countries]);
  // Opções A / B montadas a partir dos jogos do plano (vale também pra roteiros já salvos).
  const options = useMemo(() => buildOptions(plan), [plan]);
  // A opção escolhida libera a contratação da consultoria.
  const [chosenOptionRaw, setChosenOption] = useState(null);
  // Roteiros antigos tinham A/B/C (A = o que sugerimos; B e C = variações dele). Hoje: A = do seu jeito, B = sugerido.
  const chosenOption = chosenOptionRaw === "C" || (chosenOptionRaw === "A" && !(plan?.custom?.games?.length > 0)) ? "B" : chosenOptionRaw;
  // Roteiro salvo não guarda todos os jogos possíveis: a opção A pede o resto ao servidor (sem gravar no banco).
  const handleLoadAllGames = async () => {
    try {
      const fresh = await fetchPlan(answers);
      if (fresh?.possible?.length) setPlan((p) => (p ? { ...p, possible: fresh.possible } : p));
    } catch (e) {
      console.warn("Não foi possível carregar todos os jogos:", e);
    }
  };
  // Voltando do Mercado Pago sem concluir o pagamento: "failed" ou "pending" (vem na URL do retorno).
  const [paymentNotice, setPaymentNotice] = useState(null);
  const restart = () => {
    setAnswers({});
    setPlan(null);
    setPlanError(null);
    setChosenOption(null);
    setScreen("landing");
    localStorage.removeItem("tripsz_state");
  };

  const handleLogout = async () => {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    restart();
  };

  // Sempre que o passo muda, atualiza a URL na barra do navegador (sem
  // recarregar a página) pra refletir onde a pessoa está na jornada.
  // Só faz isso depois que a restauração inicial (efeito abaixo) já leu
  // a URL original — ver comentário na declaração de `initialized`.
  useEffect(() => {
    if (!initialized) return;
    const path = SCREEN_TO_PATH[screen] || "/";
    if (window.location.pathname !== path) {
      window.history.pushState({ screen }, "", path);
      // Tela nova começa sempre no topo (ex.: Contratar consultoria → checkout).
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [screen, initialized]);

  // Quando a pessoa usa o botão voltar/avançar do navegador, a URL muda
  // sozinha (o navegador cuida disso) — só precisamos escutar e refletir
  // isso de volta no estado do app.
  useEffect(() => {
    const handlePopState = () => {
      const matched = PATH_TO_SCREEN[window.location.pathname];
      if (matched) setScreen(matched);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Guarda o passo atual e as respostas no localStorage sempre que mudam.
  // É essencial porque o login com Google recarrega a página inteira (o
  // navegador sai do site, vai pro Google e volta), e sem isso a pessoa
  // perderia tudo que já tinha preenchido e voltaria pro início.
  useEffect(() => {
    if (screen !== "landing") {
      localStorage.setItem("tripsz_state", JSON.stringify({ screen, answers }));
    }
  }, [screen, answers]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Se a pessoa acabou de voltar do Mercado Pago com sucesso, leva pra lista
    // de roteiros (o pedido pago é marcado pelo webhook e o roteiro já está salvo lá).
    if (params.get("status") === "paid") {
      setScreen("roteiros");
      setInitialized(true);
      return;
    }
    const payStatus = params.get("status");
    if (window.location.pathname === "/checkout" && (payStatus === "failed" || payStatus === "pending")) setPaymentNotice(payStatus);

    // Restaura as respostas salvas (sempre — mesmo se a URL mandar num
    // passo diferente, a pessoa não pode perder o que já preencheu).
    const saved = localStorage.getItem("tripsz_state");
    let restoredScreen = null;
    if (saved) {
      try {
        const { screen: savedScreen, answers: savedAnswers } = JSON.parse(saved);
        setAnswers(savedAnswers || {});
        restoredScreen = savedScreen || null;
      } catch (e) {
        console.error("Não foi possível restaurar o progresso salvo:", e);
      }
    }

    // A URL manda mais que o localStorage: se a pessoa abriu um link
    // direto, favoritou uma etapa, ou deu F5, respeita a URL atual.
    // Só cai no passo salvo no localStorage se a URL não for reconhecida
    // (ex: a pessoa estava na home "/").
    const pathScreen = PATH_TO_SCREEN[window.location.pathname];
    setScreen(pathScreen || restoredScreen || "landing");
    setInitialized(true);

    // Detecta quando o login com Google (ou e-mail/senha) termina e uma
    // sessão passa a existir. Se a pessoa estava parada na tela de conta
    // esperando login, avança sozinho pro próximo passo do questionário.
    const supabase = supabaseBrowser();

    // App instalado na tela de início (iPhone/Android): abre sempre em "/", que é a
    // página inicial. Se a pessoa já tem sessão, leva direto pra Meus Roteiros em vez
    // de mostrar o "Entrar" de novo. No navegador comum a página inicial continua igual.
    const inApp = isNativeApp();
    const isInstalledApp = inApp || window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    if (isInstalledApp && (pathScreen || restoredScreen || "landing") === "landing") {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session) setScreen((current) => (current === "landing" ? (inApp ? "buscar" : "roteiros") : current));
      }).finally(() => { if (inApp) removeLoader(); });
    } else if (inApp) removeLoader();

    // Convite guardado antes do Google/confirmação de e-mail: resgata assim que há sessão. O resgate é no
    // servidor (pelo código), idempotente, e só é descartado em erro definitivo (vencido, já usado...).
    const redeemPendingInvite = async () => {
      const code = readPendingInvite();
      if (!code) return;
      const r = await redeemAndPrepareWelcome(code);
      if (r.ok) {
        clearPendingInvite();
        setScreen("bem-vindo");
      } else if (FINAL_INVITE_ERRORS.includes(r.code)) clearPendingInvite();
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // setTimeout: não se chama o Supabase de dentro desta função (pode travar o login).
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) setTimeout(redeemPendingInvite, 0);
      if (event === "SIGNED_IN" && session?.user) {
        setAnswers((a) => ({ ...a, userId: session.user.id }));
        const target = readAndClearPostLoginTarget();
        if (target) setScreen((current) => (current === "account" || current === "landing" ? target : current));
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // Monta o roteiro com jogos REAIS (/api/trip/plan) e salva as respostas junto
  // com a "foto" desse roteiro (coluna plan) — assim, quando a pessoa reabre o
  // roteiro depois, ela vê o que foi gerado, e não um recálculo com jogos que
  // podem ter mudado. O roteiro continua gratuito e já nasce desbloqueado; o que
  // pode ser vendido à parte é a consultoria humana (ver handleHireConsultoria).
  // Devolve a próxima tela ("account" se não há sessão, senão "resultado").
  const handleSaveTrip = async () => {
    const supabase = supabaseBrowser();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return "account";

    setPlanError(null);
    let newPlan = null;
    try {
      newPlan = await fetchPlan(answers);
      setPlan(newPlan);
    } catch (e) {
      console.error("Erro ao montar o roteiro:", e.message);
      setPlan(null);
      setPlanError(e.message || "Não foi possível montar o roteiro agora.");
    }

    const row = {
      user_id: userId,
      countries: answers.countries,
      date_start: answers.dateStart,
      date_end: answers.dateEnd,
      flex_level: answers.flexLevel,
      adults: answers.adults,
      kids: answers.kids,
      budget: answers.budget || answers.budgetCustom || null,
      package_type: answers.packageType || null,
      priority: answers.priority,
      pace: answers.pace,
      favorite_teams: answers.favoriteTeams || [],
    };
    const withPlan = newPlan ? { ...row, plan: slimPlan(newPlan), plan_generated_at: new Date().toISOString() } : row;
    let { data, error } = await supabase.from("trip_answers").insert(withPlan).select().single();
    if (error && /package_type/i.test(error.message || "")) {
      // Coluna package_type ainda não existe no banco: salva sem ela.
      const { package_type: _omit, ...rowWithout } = row;
      ({ data, error } = await supabase.from("trip_answers").insert(newPlan ? { ...rowWithout, plan: slimPlan(newPlan), plan_generated_at: new Date().toISOString() } : rowWithout).select().single());
    }
    if (error && newPlan && /plan/i.test(error.message || "")) {
      // A coluna `plan` ainda não existe no banco (migração não rodada): salva só as respostas.
      console.warn("Coluna plan ausente em trip_answers — rode supabase-migration-etapa3.sql. Salvando só as respostas.");
      ({ data, error } = await supabase.from("trip_answers").insert(row).select().single());
    }
    if (error) {
      console.error("Erro ao salvar respostas:", error.message);
      // Mesmo se salvar falhar, ainda mostramos o resultado — só não vai
      // aparecer em "Meus Roteiros" depois.
      return "resultado";
    }
    setAnswers((a) => ({ ...a, userId, tripAnswersId: data.id }));
    return "resultado";
  };

  // Guarda a foto num roteiro que já existe (ex.: roteiros antigos, criados antes da coluna plan).
  const persistPlan = async (id, p) => {
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.from("trip_answers").update({ plan: slimPlan(p), plan_generated_at: new Date().toISOString() }).eq("id", id);
      if (error) console.warn("Não foi possível guardar o roteiro:", error.message);
    } catch (e) {
      console.warn("Não foi possível guardar o roteiro:", e);
    }
  };

  // A pessoa escolheu a opção A (montou do seu jeito) ou B (sugerida por nós). Guarda no roteiro: é isso que libera a consultoria
  // (o servidor confere de novo em /api/checkout antes de gerar o pagamento).
  // `customGames` (só na opção A, "monte do seu jeito"): os jogos que a pessoa marcou, guardados dentro do plano.
  const handleChooseOption = async (key, customGames) => {
    setChosenOption(key);
    const custom = key === "A" && Array.isArray(customGames) && customGames.length > 0 ? { games: customGames } : null;
    const nextPlan = custom ? { ...(plan || {}), custom } : plan;
    if (custom) setPlan(nextPlan);
    if (!answers.tripAnswersId) return;
    try {
      const supabase = supabaseBrowser();
      const patch = { selected_option: key, selected_option_at: new Date().toISOString(), ...(custom ? { plan: slimPlan(nextPlan) } : {}) };
      const { error } = await supabase.from("trip_answers").update(patch).eq("id", answers.tripAnswersId);
      if (error) console.warn("Não foi possível guardar a opção escolhida (rode a migração da Etapa 3b):", error.message);
    } catch (e) {
      console.warn("Não foi possível guardar a opção escolhida:", e);
    }
  };

  // Carrega o plano da tela aberta: primeiro a foto salva no banco; se não houver
  // (roteiro antigo, ou a pessoa recarregou a página), recalcula com os jogos reais.
  const loadPlan = async (isCancelled = () => false) => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      if (answers.tripAnswersId) {
        const supabase = supabaseBrowser();
        const { data } = await supabase.from("trip_answers").select("*").eq("id", answers.tripAnswersId).maybeSingle();
        if (data?.selected_option && !isCancelled()) setChosenOption(data.selected_option);
        if (data?.plan) {
          if (!isCancelled()) setPlan(data.plan);
          return;
        }
      }
      if (!answers.countries?.length) return;
      const fresh = await fetchPlan(answers);
      if (isCancelled()) return;
      setPlan(fresh);
      if (answers.tripAnswersId) persistPlan(answers.tripAnswersId, fresh);
    } catch (e) {
      if (!isCancelled()) setPlanError(e.message || "Não foi possível montar o roteiro agora.");
    } finally {
      setPlanLoading(false);
    }
  };

  // Ao abrir "resultado" ou "roteiro" sem plano em memória, busca. Não tenta de novo
  // sozinho se acabou de dar erro (a pessoa usa o botão "Tentar de novo").
  useEffect(() => {
    if (!initialized || plan || planError) return;
    if (screen !== "resultado" && screen !== "roteiro") return;
    let cancelled = false;
    loadPlan(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [screen, initialized, plan, answers.tripAnswersId]);

  // O aviso de pagamento só vale dentro do checkout. Só limpa depois que o app terminou de
  // inicializar: na primeira renderização a tela ainda é a inicial, e limpar antes apagaria o
  // aviso que acabou de ser lido da URL do retorno do Mercado Pago.
  useEffect(() => {
    if (initialized && screen !== "checkout") setPaymentNotice(null);
  }, [screen, initialized]);

  // Recarregou (ou voltou do Mercado Pago) direto no checkout: a opção escolhida só existia na
  // memória — busca a que ficou guardada no roteiro, pra o botão de contratar continuar valendo.
  useEffect(() => {
    if (!initialized || screen !== "checkout" || chosenOption || !answers.tripAnswersId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabaseBrowser().from("trip_answers").select("selected_option").eq("id", answers.tripAnswersId).maybeSingle();
      if (!cancelled && data?.selected_option) setChosenOption(data.selected_option);
    })();
    return () => {
      cancelled = true;
    };
  }, [screen, initialized, chosenOption, answers.tripAnswersId]);

  return (
    <div style={{ width: "100%", minHeight: "100vh", paddingBottom: native && TAB_SCREENS.has(screen) ? "calc(60px + env(safe-area-inset-bottom))" : 0 }}>
      <FontImports />
      {screen === "landing" && native === true && (
        <Onboarding
          onCreateAccount={() => { setPostLoginTarget("buscar"); setScreen("criarconta"); }}
          onLogin={() => { setPostLoginTarget("buscar"); setShowGlobalLoginModal(true); }}
        />
      )}
      {screen === "landing" && native !== true && (
        <LandingPage
          onStart={async () => {
            const supabase = supabaseBrowser();
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setStepOffset(1);
              setScreen("destino");
            } else {
              setStepOffset(0);
              setPostLoginTarget("destino");
              setScreen("account");
            }
          }}
          onSubscribe={async () => {
            const supabase = supabaseBrowser();
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setScreen("assinar");
            } else {
              setPostLoginTarget("assinar");
              setScreen("criarconta");
            }
          }}
          onLogin={async () => {
            const supabase = supabaseBrowser();
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setScreen("roteiros");
              return;
            }
            setPostLoginTarget("roteiros");
            setShowGlobalLoginModal(true);
          }}
        />
      )}
      {screen === "criarconta" && (
        <CriarConta
          onDone={() => setScreen(readAndClearPostLoginTarget() || "roteiros")}
          onLogin={() => setShowGlobalLoginModal(true)}
          onHome={restart}
        />
      )}
      {screen === "assinar" && <AssinarStandalone onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "account" && <StepAccount answers={answers} setAnswers={setAnswers} onNext={() => setScreen(readAndClearPostLoginTarget() || "destino")} onBack={restart} />}
      {screen === "destino" && <StepDestino answers={answers} setAnswers={setAnswers} onNext={() => setScreen("times")} onBack={() => setScreen(stepOffset === 1 ? "roteiros" : "account")} onHome={restart} stepOffset={stepOffset} />}
      {screen === "times" && <StepTimesFavoritos answers={answers} setAnswers={setAnswers} onNext={() => setScreen("datas")} onBack={() => setScreen("destino")} onHome={restart} stepOffset={stepOffset} />}
      {screen === "datas" && <StepDatas answers={answers} setAnswers={setAnswers} onNext={() => setScreen("pessoas")} onBack={() => setScreen("times")} onHome={restart} stepOffset={stepOffset} />}
      {screen === "pessoas" && <StepPessoasOrcamento answers={answers} setAnswers={setAnswers} onNext={() => setScreen("preferencias")} onBack={() => setScreen("datas")} onHome={restart} stepOffset={stepOffset} />}
      {screen === "preferencias" && <StepPreferencias answers={answers} setAnswers={setAnswers} onNext={() => setScreen("loading")} onBack={() => setScreen("pessoas")} onHome={restart} stepOffset={stepOffset} />}
      {screen === "loading" && <LoadingScreen onWork={handleSaveTrip} onDone={(next) => setScreen(next || "resultado")} />}
      {screen === "resultado" && <ResultadoRoteiro answers={answers} trip={trip} options={options} chosenOption={chosenOption} onChooseOption={handleChooseOption} onLoadAllGames={handleLoadAllGames} planLoading={planLoading} planError={planError} onRetryPlan={() => loadPlan()} onHireConsultoria={() => { if (chosenOption) setScreen("checkout"); }} onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "checkout" && <Checkout answers={answers} selectedOption={chosenOption} paymentNotice={paymentNotice} onBack={() => setScreen("resultado")} onDone={() => setScreen("roteiro")} onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "roteiro" && (
        <RoteiroDetalhe
          answers={answers}
          trip={trip}
          options={options}
          chosenOption={chosenOption}
          onChooseOption={handleChooseOption}
          onLoadAllGames={handleLoadAllGames}
          planLoading={planLoading}
          planError={planError}
          onRetryPlan={() => loadPlan()}
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onBackToRoteiros={() => setScreen("roteiros")}
          onHireConsultoria={() => { if (chosenOption) setScreen("checkout"); }}
        />
      )}
      {screen === "roteiros" && (
        <MeusRoteiros
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onCreateNew={() => { setAnswers((a) => ({ userId: a.userId })); setPlan(null); setPlanError(null); setChosenOption(null); setStepOffset(1); setScreen("destino"); }}
          onOpenTrip={(tripAnswers, savedPlan, savedOption) => {
            setAnswers((a) => ({ ...a, ...tripAnswers }));
            setPlan(savedPlan || null);
            setPlanError(null);
            setChosenOption(savedOption || null);
            setScreen("roteiro");
          }}
          onEditTrip={(tripAnswers) => {
            setAnswers((a) => ({ ...a, ...tripAnswers }));
            setPlan(null);
            setPlanError(null);
            setChosenOption(null);
            setStepOffset(1);
            setScreen("destino");
          }}
        />
      )}
      {screen === "conquistas" && (
        <MinhasConquistas
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onCreateNew={() => { setAnswers((a) => ({ userId: a.userId })); setPlan(null); setPlanError(null); setChosenOption(null); setStepOffset(1); setScreen("destino"); }}
        />
      )}
      {screen === "bem-vindo" && <BoasVindasConvite onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "acompanhantes" && <QuemFoiComVoce onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "jogo-salvo" && <JogoSalvo onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "jogos" && (
        <MeusJogosHistorico
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onRegisterNew={() => setScreen("registrar-jogo")}
          onCompanions={(game) => { saveDraft({ game, tagged: [] }); setScreen("acompanhantes"); }}
        />
      )}
      {screen === "buscar" && <BuscarJogos onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "calendario" && <MeuCalendario onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "registrar-jogo" && (
        <RegistrarJogo
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onDone={() => setScreen("jogos")}
          onCompanions={(game) => { saveDraft({ game, tagged: [] }); setScreen("acompanhantes"); }}
        />
      )}
      {screen === "nivel" && (
        <MeuNivel
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onCreateNew={() => { setAnswers((a) => ({ userId: a.userId })); setPlan(null); setPlanError(null); setChosenOption(null); setStepOffset(1); setScreen("destino"); }}
        />
      )}
      {screen === "notificacoes" && <Notificacoes onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "perfil" && <MeuPerfil onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "assinatura" && <MinhaAssinatura onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "ranking" && <RankingTorcedores onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {showGlobalLoginModal && (
        <LoginModal
          fullScreen={native === true}
          onClose={() => setShowGlobalLoginModal(false)}
          onCreateAccount={() => { setShowGlobalLoginModal(false); setScreen("criarconta"); }}
        />
      )}
      {native === true && TAB_SCREENS.has(screen) && <BottomTabBar screen={screen} onNavigate={(key) => setScreen(key)} />}
      {native === true && TAB_SCREENS.has(screen) && <CheckinPopup onNavigate={(key) => setScreen(key)} />}
      <AchievementWatcher active={TAB_SCREENS.has(screen)} />
    </div>
  );
}
