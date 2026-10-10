"use client";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, GREEN, GREEN_BG, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import { AuthedFooter } from "../nav/AuthedFooter";
import { TopNavPublic } from "../nav/TopNavPublic";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { useIsMobile } from "../ui/useIsMobile";
import { Award, Check, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";

export const PHOTO_HERO = "/foto-hero.jpg";

export const PHOTO_FINALCTA = "/foto-cta-final.jpg";

export const PHOTO_STADIUM = "/foto-estadio.jpg";

export function LandingPage({ onStart, onSubscribe, onLogin }) {
  const isMobile = useIsMobile();
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  // Rola até uma seção específica se a pessoa clicou num item do menu
  // (tipo "FAQ") estando em outra tela — a navegação guarda o alvo aqui
  // e a Landing, ao montar, resolve a rolagem sozinha.
  useEffect(() => {
    const target = sessionStorage.getItem("tripsz_scroll_target");
    if (target) {
      sessionStorage.removeItem("tripsz_scroll_target");
      // Pequeno atraso pra garantir que a seção já foi renderizada.
      setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, []);

  const handleNavItem = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const steps = [
    { n: "01", icon: "shieldBadge", title: "Defina países, datas e times", body: "Selecione os países, datas e times que você quer ver. A plataforma usa esses filtros para montar seu roteiro." },
    { n: "02", icon: "soccerBall", title: "Receba o roteiro de jogos", body: "A plataforma cruza as partidas disponíveis e entrega os jogos possíveis e a melhor sequência de cidades para sua viagem." },
    { n: "03", icon: "planeTakeoff", title: "Organize o restante da viagem", body: "Use o roteiro como base e, se precisar, contrate uma consultoria humana para ajudar com voos, hotéis e detalhes da viagem." },
  ];
  const stats = [["450+", "Estádios Mapeados"], ["1.2k+", "Jogos por Temporada"], ["15", "Países Cobertos"], ["100%", "De Ingressos Entregues"]];
  const diffs = [
    ["Roteiro focado em jogos", "A plataforma cruza calendários de ligas e copas para entregar os jogos possíveis e a melhor sequência de cidades para sua viagem."],
    ["Sem reservas incluídas", "A plataforma entrega o roteiro de jogos. Você cuida de ingressos, voos e hospedagem, ou contrata uma consultoria para ajudar no restante."],
    ["Consultoria opcional", "Se precisar, contrate uma consultoria humana para ajudar com voos, hotéis, ingressos e detalhes da viagem."],
  ];
  const profiles = [
    { icon: "binoculars", title: "Groundhopper", body: "Seu objetivo é colecionar estádios. Quanto mais bizarro, antigo ou tradicional o campo, melhor." },
    { icon: "flame", title: "Fanático", body: "Segue o time do coração nas glórias e tragédias. Prioriza clássicos monumentais e ingressos disputados." },
    { icon: "compass", title: "Explorador", body: "Une futebol com gastronomia local, visitas guiadas a museus e noites de cerveja pré-jogo com locais." },
  ];
  const faqs = [
    ["Como garantem que os ingressos são legítimos?", "Nós trabalhamos apenas com revendedores oficiais de clubes e operadoras parceiras certificadas com seguro contra cancelamentos."],
    ["E se a data do jogo mudar por causa da TV?", "As ligas europeias costumam fixar datas de 3 a 5 semanas antes. Nossa equipe monitora os calendários e monta o roteiro prevendo janelas de segurança nas datas de voos e hotéis."],
    ["Posso viajar com crianças ou grupos?", "Sim! Adaptamos o perfil da viagem para roteiros mais familiares, com setores calmos e acessíveis nos estádios."],
    ["Posso cancelar a assinatura a qualquer momento?", "Sim, sem multa. Seu acesso continua até o fim do período pago."],
    ["O que acontece com meu Passport se eu cancelar?", "Seus dados ficam salvos, mas o acesso ao Passport e às conquistas fica pausado até reativar."],
    ["Preciso ser assinante para contratar a consultoria?", "Não, a consultoria é um add-on avulso. Mas assinantes ganham 15% de desconto."],
    ["Como funciona o desconto anual?", "No plano anual você paga R$ 99,90/ano em vez de R$ 118,80 (12x R$ 9,90), economizando R$ 18,90."],
    ["É só futebol europeu ou inclui jogos no Brasil?", "A plataforma cobre 13 países, incluindo Brasil, Argentina, Uruguai, Chile e Colômbia, além das principais ligas europeias."],
  ];

  const px = isMobile ? "16px" : "80px";

  return (
    <div style={{ background: BG, width: "100%" }}>
      <TopNavPublic onStart={onStart} onLogin={onLogin} onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })} onNavItem={handleNavItem} active="Como Funciona" />

      {/* hero */}
      <div style={{ position: "relative", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 64, alignItems: isMobile ? "flex-start" : "center", padding: isMobile ? `40px ${px}` : `100px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", gap: isMobile ? 20 : 32, alignItems: "flex-start", width: "100%" }}>
          <Badge>A Jornada Definitiva</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 32 : 64, lineHeight: 1.05, color: TEXT, margin: 0 }}>Encontre o melhor roteiro de futebol para sua viagem</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 16 : 22, lineHeight: 1.5, color: BODY, margin: 0 }}>Escolha países, datas e times. Nossa plataforma cruza as partidas disponíveis e entrega os jogos possíveis e a melhor sequência de cidades para sua viagem.</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 16, width: isMobile ? "100%" : "auto" }}>
            <Button onClick={onStart} icon={<Icon name="arrowRight" size={16} color={TEXT} />}>Montar meu roteiro</Button>
            <div onClick={() => handleNavItem("como-funciona")} style={{ background: BG_ALT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 24px", cursor: "pointer", textAlign: "center" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>Ver como funciona</p>
            </div>
          </div>
        </div>
        <div style={{ position: "relative", width: isMobile ? "100%" : 540, height: isMobile ? 220 : 420, borderRadius: isMobile ? 12 : 16, flexShrink: 0, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <img src={PHOTO_HERO} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>

      {/* como funciona */}
      <div id="como-funciona" style={{ background: BG_ALT, padding: isMobile ? `48px ${px}` : `100px ${px}`, display: "flex", flexDirection: "column", gap: isMobile ? 32 : 64 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <Badge>O Caminho até a Arquibancada</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 40, color: TEXT, textAlign: "center", margin: 0 }}>Como a plataforma ajuda você a montar o melhor roteiro</p>
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 32 }}>
          {steps.map((s) => (
            <div key={s.n} style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? 20 : 40, display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: GREEN }}>{s.n}</span>
                <Icon name={s.icon} size={isMobile ? 18 : 24} color={TEXT} />
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 18 : 22, color: TEXT, margin: 0 }}>{s.title}</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 16, lineHeight: 1.5, color: BODY, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* stats */}
      <div style={{ background: BG, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", padding: isMobile ? `32px ${px}` : `48px ${px}`, gap: isMobile ? 20 : 0 }}>
        {stats.map(([n, label]) => (
          <div key={label} style={{ flex: isMobile ? "1 0 40%" : 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 40, color: GREEN, margin: 0 }}>{n}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 10 : 12, color: MUTED, textTransform: "uppercase", margin: 0, textAlign: "center" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* diferenciais */}
      <div id="diferenciais" style={{ background: BG_ALT, display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 80, padding: isMobile ? `48px ${px}` : `100px ${px}` }}>
        <div style={{ width: isMobile ? "100%" : 500, display: "flex", flexDirection: "column", gap: isMobile ? 12 : 24, flexShrink: 0, alignItems: "flex-start" }}>
          <Badge>Alma de Torcedor</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 40, color: TEXT, margin: 0 }}>Como a plataforma ajuda você a planejar sua viagem</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 18, lineHeight: 1.6, color: BODY, margin: 0 }}>A plataforma foca no que importa: encontrar os jogos possíveis e a melhor sequência de cidades. Depois, você decide se quer ajuda humana para fechar voos, hotéis e detalhes da viagem.</p>
          {!isMobile && <div style={{ paddingTop: 16 }}><Button variant="outline" onClick={() => handleNavItem("como-funciona")}>Ver como funciona</Button></div>}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: isMobile ? 12 : 24 }}>
          {diffs.map(([title, body]) => (
            <div key={title} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: isMobile ? 16 : 24, display: "flex", gap: isMobile ? 12 : 20 }}>
              <div style={{ width: isMobile ? 28 : 40, height: isMobile ? 28 : 40, borderRadius: isMobile ? 14 : 20, background: GREEN_BUTTON, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="shieldCheck" size={isMobile ? 14 : 20} color={TEXT} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 15 : 18, color: TEXT, margin: 0 }}>{title}</p>
                <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 15, lineHeight: 1.5, color: BODY, margin: 0 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* passport-section */}
      <div id="passaporte" style={{ background: "#fff", padding: isMobile ? `48px ${px}` : `100px ${px}`, display: "flex", flexDirection: "column", gap: isMobile ? 32 : 64, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", maxWidth: 900 }}>
          <Badge>Football Passport</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 40, color: TEXT, textAlign: "center", margin: 0 }}>O passaporte que transforma sua jornada em uma história pessoal</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, lineHeight: 1.6, color: BODY, textAlign: "center", margin: 0 }}>O Football Passport é a ferramenta da plataforma para registrar jogos, estádios, conquistas e progresso. Ele ajuda a planejar viagens, acompanhar o histórico e compartilhar sua paixão por futebol de forma única.</p>
        </div>
        <div style={{ background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 16, padding: 32, width: isMobile ? "100%" : 420, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 24, boxShadow: "0px 12px 24px rgba(0,200,83,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>FOOTBALL PASSPORT</p>
            <Award size={20} color={GREEN} />
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ width: 80, height: 100, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden", flexShrink: 0 }}>
              <img src="/passport-exemplo.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nome do Titular</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Lauro Guedes</p>
              </div>
              <div>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nível de Acesso</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>VIP GROUNDHOPPER</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>ID: #9284-MD</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>ATIVAÇÃO: 2026</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[["stadium", "Estádios", "109 visitados"], ["award", "Conquistas", "10 desbloqueadas"], ["trophy", "Progresso", "158 jogos"]].map(([iconKey, label, value]) => (
              <div key={label} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ background: GREEN_BG, width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {iconKey === "stadium" ? <Icon name="stadium" size={20} color={GREEN} /> : iconKey === "award" ? <Award size={20} color={GREEN} /> : <Trophy size={20} color={GREEN} />}
                </div>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{label}</p>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: GREEN, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* perfis-viajante */}
      <div id="perfis-viajante" style={{ background: BG, padding: isMobile ? `48px ${px}` : `100px ${px}`, display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <Badge gold>Qual é o seu Perfil?</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 40, color: TEXT, textAlign: "center", margin: 0 }}>Para cada tipo de apaixonado</p>
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 20 }}>
          {profiles.map((p) => (
            <div key={p.title} style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: BG_ALT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={p.icon} size={24} color={TEXT} />
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 18 : 22, color: TEXT, margin: 0 }}>{p.title}</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 15, lineHeight: 1.5, color: BODY, margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* pricing */}
      <div id="pricing" style={{ background: BG_ALT, padding: isMobile ? `48px ${px}` : `100px ${px}`, display: "flex", flexDirection: "column", gap: isMobile ? 32 : 48, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}>
          <Badge>Nossos Planos</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 40, color: TEXT, margin: 0 }}>Escolha o plano ideal para sua jornada</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 14 : 16, color: "#475569", margin: 0, width: isMobile ? "100%" : 600 }}>Crie roteiros de futebol personalizados gratuitamente ou desbloqueie a experiência completa com o Passport Tripsz.</p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: billingAnnual ? MUTED : TEXT, textTransform: "uppercase", margin: 0 }}>Mensal</p>
          <div onClick={() => setBillingAnnual((v) => !v)} style={{ width: 44, height: 24, borderRadius: 12, background: GREEN, position: "relative", cursor: "pointer" }}>
            <div style={{ position: "absolute", top: 2, left: billingAnnual ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: "#fff", transition: "left .15s" }} />
          </div>
          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: billingAnnual ? TEXT : MUTED, margin: 0 }}>Anual (-16%)</p>
        </div>

        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 20 : 32, width: "100%", maxWidth: 1000 }}>
          {/* Grátis */}
          <div style={{ flex: 1, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: isMobile ? 24 : 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#f3f4f6", padding: "4px 12px", borderRadius: 999, alignSelf: "flex-start" }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: TEXT, margin: 0 }}>GRATUITO</p>
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, color: TEXT, margin: 0 }}>R$ 0</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#6b7280", margin: 0 }}>para sempre</p>
            </div>
            <div onClick={onStart} style={{ border: `1.5px solid ${GREEN}`, borderRadius: 999, padding: "12px 20px", textAlign: "center", cursor: "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>Começar grátis</p>
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[["Criação de roteiros ilimitados", true], ["Busca por jogos em 13 países", true], ["Football Passport (até 20 jogos)", true], ["Categorias, conquistas e ranking", true], ["Perfil público compartilhável", true], ["Mais de 20 jogos registrados", false], ["Importação em massa (Futbology)", false], ["Desconto em consultorias", false]].map(([label, ok]) => (
                <div key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {ok ? <Check size={16} color={GREEN} /> : <X size={16} color="#9ca3af" />}
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: ok ? TEXT : "#6b7280", margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Assinante — plano popular */}
          <div style={{ flex: 1, background: "#fff", border: `2px solid ${GREEN}`, boxShadow: "0px 12px 12px rgba(0,200,83,0.13)", borderRadius: 16, padding: isMobile ? 24 : 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: GREEN, padding: "4px 12px", borderRadius: 999, alignSelf: "flex-start" }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: "#fff", margin: 0 }}>MAIS POPULAR</p>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, color: TEXT, margin: 0 }}>{billingAnnual ? "R$ 99,90" : "R$ 9,90"}</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#6b7280", margin: 0 }}>{billingAnnual ? "/ ano" : "/ mês"}</p>
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, color: GREEN, margin: 0 }}>{billingAnnual ? "Economia de R$ 18,90/ano" : "ou R$ 99,90/ano e economize 16%"}</p>
            </div>
            <div onClick={onSubscribe} style={{ background: GREEN, borderRadius: 999, padding: "12px 20px", textAlign: "center", cursor: "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>Assinar agora</p>
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {["Tudo do plano gratuito", "Jogos ilimitados no Football Passport", "Importação em massa de outros apps (Futbology)", "Histórico completo de jogos", "15% de desconto em consultorias", "Alertas personalizados de jogos"].map((label) => (
                <div key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Check size={16} color={GREEN} />
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: TEXT, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Add-on Consultoria */}
          <div style={{ flex: 1, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: isMobile ? 24 : 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#f3f4f6", padding: "4px 12px", borderRadius: 999, alignSelf: "flex-start" }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: TEXT, margin: 0 }}>ADD-ON</p>
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, color: TEXT, margin: 0 }}>R$ 149,90</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#6b7280", margin: 0 }}>por sessão</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, color: "#ff5722", margin: 0 }}>R$ 127,42 para assinantes (-15%)</p>
            </div>
            <div onClick={onStart} style={{ border: `1.5px solid ${BORDER}`, borderRadius: 999, padding: "12px 20px", textAlign: "center", cursor: "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Contratar consultoria</p>
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {["Sessão de 30min com especialista", "Ajuda com hotéis e hospedagem", "Sugestões de reservas e transfers", "Ajustes finais do roteiro", "Agendamento flexível", "Suporte pós-sessão por 48h"].map((label) => (
                <div key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Check size={16} color={GREEN} />
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: TEXT, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* faq */}
      <div id="faq" style={{ background: BG, padding: isMobile ? `48px ${px}` : `100px ${px}`, display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <Badge>Dúvidas Frequentes</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 40, color: TEXT, textAlign: "center", margin: 0 }}>Perguntas na Linha de Fundo</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {faqs.map(([q, a], i) => {
            const isOpen = openFaqIndex === i;
            return (
              <div key={q} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: isMobile ? 16 : 24, display: "flex", flexDirection: "column", gap: isOpen ? 12 : 0 }}>
                <div onClick={() => setOpenFaqIndex(isOpen ? null : i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 15 : 18, color: TEXT, margin: 0 }}>{q}</p>
                  <Icon name="chevronDown" size={16} color={MUTED} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
                </div>
                {isOpen && <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 15, lineHeight: 1.5, color: BODY, margin: 0 }}>{a}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* final cta */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: isMobile ? 16 : 24, padding: isMobile ? `64px ${px}` : `120px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_FINALCTA} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <p style={{ position: "relative", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 48, color: TEXT, margin: 0, textAlign: "center", width: isMobile ? "100%" : 800 }}>Pronto para encontrar o melhor roteiro de futebol para sua viagem?</p>
        <p style={{ position: "relative", fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 18, color: BODY, margin: 0, textAlign: "center", width: isMobile ? "100%" : 600 }}>Preencha o questionário e receba um roteiro com os jogos possíveis e a melhor sequência de cidades. Depois, contrate uma consultoria humana se precisar de ajuda com o restante da viagem.</p>
        <div style={{ position: "relative", width: isMobile ? "100%" : "auto" }}>
          <Button onClick={onStart} icon={<Icon name="arrowRight" size={16} color={TEXT} />}>Montar meu roteiro</Button>
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}
