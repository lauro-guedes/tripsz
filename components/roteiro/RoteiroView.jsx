"use client";
import { supabaseBrowser } from "../../lib/supabase";
import { teamLabel } from "../../lib/textUtils";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, GOLD_BG, GOLD_BORDER, GREEN, GREEN_BG, GREEN_BUTTON2, MUTED, TEXT } from "../../lib/tokens";
import { durationRange } from "../../lib/tripOptions";
import TeamBadge from "../TeamBadge";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav } from "../nav/AuthedNav";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";
import { useIsMobile } from "../ui/useIsMobile";
import { PlanFeedback } from "./PlanFeedback";
import { useEffect, useState } from "react";

// Formata uma data como "18 MAR 2025" — igual ao Figma, sem o "de" que o
// toLocaleDateString("pt-BR") normalmente adiciona.
export const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function formatDateBadge(date) {
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, "0")} ${MESES_ABREV[date.getMonth()]} ${date.getFullYear()}`;
}


export const OPTION_TONES = {
  green: { bg: GREEN },
  navy: { bg: "#1E3A5F" },
  slate: { bg: "#334155" },
};

export const NAVY_PILL = { background: "#1E3A5F", borderRadius: 4, padding: "3px 8px", display: "inline-flex" };

export function LeaguePill({ children }) {
  return (
    <span style={{ ...NAVY_PILL, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: "#fff", whiteSpace: "nowrap" }}>{children}</span>
  );
}

/** Um dos cartões A / B / C com o dia a dia e o botão de escolher. */
export function OptionCard({ opt, chosen, onChoose, isMobile }) {
  const tone = OPTION_TONES[opt.tone] || OPTION_TONES.slate;
  return (
    <div style={{ background: "#fff", border: chosen ? `2px solid ${GREEN}` : `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ background: tone.bg, padding: isMobile ? "14px 16px" : "16px 24px", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 8 : 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: tone.bg, margin: 0 }}>{opt.key}</p>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 15 : 16, color: "#fff", margin: 0 }}>Opção {opt.key} — {opt.title}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: "rgba(255,255,255,0.8)", margin: 0 }}>{opt.summary}</p>
          </div>
        </div>
        {opt.badge && (
          <span style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 999, padding: "3px 12px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap" }}>{opt.badge}</span>
        )}
      </div>
      {opt.omittedText && (
        <div style={{ background: GOLD_BG, borderBottom: `1px solid ${GOLD_BORDER}`, padding: isMobile ? "10px 16px" : "10px 24px" }}>
          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>{opt.omittedText}</p>
        </div>
      )}
      <div style={{ padding: isMobile ? 16 : 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: BODY, margin: 0 }}>{opt.description}</p>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {opt.items.map((it, i) => {
            const isGame = it.type === "game";
            return (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: i === opt.items.length - 1 ? "none" : `1px solid ${BORDER}` }}>
                <span style={{ minWidth: 48, textAlign: "center", borderRadius: 4, padding: "3px 6px", background: isGame ? GREEN_BG : BG, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: isGame ? GREEN : MUTED, flexShrink: 0 }}>{it.day}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{it.title}</p>
                    {isGame && it.league && <LeaguePill>{it.league}</LeaguePill>}
                  </div>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 12, lineHeight: 1.4, color: MUTED, margin: "2px 0 0" }}>{it.body}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div
          onClick={chosen ? undefined : () => onChoose(opt.key)}
          style={{ background: chosen ? "#fff" : GREEN_BUTTON2, border: `1.5px solid ${chosen ? GREEN : GREEN_BUTTON2}`, borderRadius: 8, padding: "13px 24px", textAlign: "center", cursor: chosen ? "default" : "pointer" }}
        >
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: chosen ? GREEN : "#fff", textTransform: "uppercase", margin: 0 }}>
            {chosen ? `✓ Opção ${opt.key} escolhida` : `Escolher opção ${opt.key}`}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Cartão da consultoria (fica na lateral no computador e depois das opções no celular).
 *  O botão só funciona depois de escolher uma das opções A / B / C. */
export function ConsultoriaCard({ chosenOpt, needChoice, onHire, onNeedChoice, isMobile }) {
  const enabled = !!chosenOpt;
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 16, padding: isMobile ? 20 : 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Consultoria opcional</p>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, color: TEXT, margin: "4px 0" }}>R$ 149,90</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.45, color: BODY, margin: 0 }}>Acompanhamento humano para completar voos, hotéis, ingressos e outros detalhes da viagem.</p>
      </div>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>O que você recebe</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {["Ajuste de voos, hotéis e deslocamentos com base no seu roteiro.", "Sugestões de hospedagem, transporte e dicas práticas para a viagem.", "Ajuda para organizar ingressos, check-in e outros detalhes operacionais."].map((l) => (
          <div key={l} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: GREEN, marginTop: 6, flexShrink: 0 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.4, color: BODY, margin: 0 }}>{l}</p>
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: BORDER }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[["Valor", "R$ 149,90"], ["Pagamento", "1x"], ["Agenda", "1 conversa"]].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{l}</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: TEXT, margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>
      {enabled ? (
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, margin: 0 }}>✓ Baseada na Opção {chosenOpt.key} — {chosenOpt.title}</p>
      ) : (
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: needChoice ? GOLD : MUTED, margin: 0 }}>
          Escolha uma das opções de roteiro (A, B ou C) para contratar a consultoria.
        </p>
      )}
      <div
        onClick={enabled ? onHire : onNeedChoice}
        style={{ background: GREEN_BUTTON2, opacity: enabled ? 1 : 0.45, padding: "14px 24px", borderRadius: 8, cursor: enabled ? "pointer" : "not-allowed", textAlign: "center" }}
      >
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", textTransform: "uppercase", margin: 0 }}>Contratar e agendar conversa</p>
      </div>
    </div>
  );
}

/** Avisos do roteiro (sem listar jogo por jogo o que ficou de fora — isso fica na Opção C). */
export function restrictionBullets(trip, options) {
  const bullets = [];
  const route = trip.cities.length >= 2 ? ` ${trip.cities.join(" → ")}` : "";
  bullets.push(
    options.length > 1
      ? `Compare alternativas para combinar as partidas com o tempo de deslocamento${route}.`
      : "Compare as opções para ver o ritmo que mais combina com você."
  );
  bullets.push("A inclusão no roteiro não garante ingresso. Verifique a disponibilidade antes de reservar.");
  const notes = trip.notes || [];
  if (notes.some((n) => n.type === "favorite_not_fit")) {
    bullets.push("Alguns jogos dos seus times favoritos não couberam em todas as opções — compare as alternativas.");
  }
  // Países pedidos que ficaram de fora (ou foram completados com jogo nacional): a pessoa precisa saber o porquê.
  for (const n of notes) {
    if (["country_not_fit", "country_without_games", "country_fallback_domestic"].includes(n.type) && n.message) bullets.push(n.message);
  }
  for (const n of notes) {
    if (bullets.length >= 8) break;
    if (["flex_used", "approx_location", "unlocated", "cap", "favorite_without_games"].includes(n.type) && n.message) bullets.push(n.message);
  }
  return bullets;
}

/** Tela do roteiro: usada logo depois do questionário (Resultado) e ao abrir um roteiro salvo (Detalhe). */
export function RoteiroView({ trip, options, chosenOption, onChooseOption, planLoading, planError, onRetryPlan, onHireConsultoria, onNavigate, onLogout, onBack }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [viewKey, setViewKey] = useState("A");
  const [needChoice, setNeedChoice] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      setUserName(data.user?.user_metadata?.name || data.user?.email || "");
      setUserAvatar(data.user?.user_metadata?.avatar_url || null);
    })();
  }, []);

  // no celular mostra uma opção por vez: abre na que a pessoa já escolheu
  useEffect(() => {
    if (chosenOption) setViewKey(chosenOption);
  }, [chosenOption]);

  const chosenOpt = options.find((o) => o.key === chosenOption) || null;
  const visibleKey = options.some((o) => o.key === viewKey) ? viewKey : options[0]?.key;
  const hasContent = !planLoading && !planError && trip.games.length > 0 && options.length > 0;
  const duration = durationRange(options);
  const durationShort = duration.replace(" a ", "–");
  const leagues = [...new Set(trip.games.map((g) => g.competition).filter(Boolean))];

  const handleChoose = (key) => {
    setNeedChoice(false);
    onChooseOption(key);
  };
  const handleNeedChoice = () => {
    setNeedChoice(true);
    const el = typeof document !== "undefined" ? document.getElementById("opcoes-roteiro") : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const consultoria = (
    <ConsultoriaCard chosenOpt={chosenOpt} needChoice={needChoice} onHire={onHireConsultoria} onNeedChoice={handleNeedChoice} isMobile={isMobile} />
  );

  const summary = (
    <div style={{ background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Roteiro completo</p>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, lineHeight: 1.15, color: TEXT, margin: 0 }}>Roteiro {trip.countries.join(" + ")}</p>
      <p style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.5, color: BODY, margin: 0 }}>
        Você já tem acesso ao roteiro completo. Escolha a opção {options.length > 2 ? "A, B ou C" : "A ou B"} que melhor se adapta ao seu estilo de viagem.
      </p>
      <div style={{ height: 1, background: BORDER }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          ["Jogos possíveis", `${trip.games.length} ${trip.games.length === 1 ? "jogo" : "jogos"}`],
          ["Cidades", `${trip.cities.length} ${trip.cities.length === 1 ? "cidade" : "cidades"}`],
          ["Opções de duração", duration],
          ...(trip.cities.length >= 2 ? [["Deslocamento", trip.cities.join(" → ")]] : []),
        ].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{l}</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: TEXT, margin: 0, textAlign: "right" }}>{v}</p>
          </div>
        ))}
        {leagues.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Liga</p>
            <span style={{ ...NAVY_PILL, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: "#fff" }}>{leagues[0]}{leagues.length > 1 ? ` +${leagues.length - 1}` : ""}</span>
          </div>
        )}
      </div>
      <div style={{ height: 1, background: BORDER }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Acesso ao roteiro</p>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>Já incluso</p>
      </div>
    </div>
  );

  const bullets = hasContent ? restrictionBullets(trip, options) : [];

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="roteiros" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      {/* faixa do título */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 10 : 24, padding: isMobile ? "14px 16px" : `16px ${px}` }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <Badge>Meus Roteiros</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 16 : 20, color: TEXT, margin: 0 }}>Roteiro {trip.countries.join(" + ")}</p>
        </div>
        {hasContent && (
          <div style={{ display: "flex", gap: isMobile ? 12 : 24, fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 12, color: MUTED, flexWrap: "wrap" }}>
            <p style={{ margin: 0 }}>• {durationShort}</p>
            <p style={{ margin: 0 }}>• {trip.games.length} {trip.games.length === 1 ? "jogo possível" : "jogos possíveis"}</p>
            <p style={{ margin: 0 }}>• {trip.cities.length} {trip.cities.length === 1 ? "cidade" : "cidades"}</p>
          </div>
        )}
        {onBack && !isMobile && (
          <div onClick={onBack} style={{ background: GREEN, padding: "10px 20px", borderRadius: 6, cursor: "pointer", textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", margin: 0 }}>← Voltar para meus roteiros</p>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 32, alignItems: "flex-start", padding: isMobile ? "20px 16px 32px" : `40px ${px} 80px` }}>
        <div style={{ flex: 1, minWidth: 0, width: "100%", display: "flex", flexDirection: "column", gap: isMobile ? 24 : 32 }}>
          {!hasContent && <PlanFeedback loading={planLoading} error={planError} notes={trip.notes} empty={trip.games.length === 0} onRetry={onRetryPlan} />}

          {hasContent && (
            <>
              {/* restrições */}
              <div style={{ background: GOLD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: 12, padding: isMobile ? 16 : 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", margin: 0 }}>!</p>
                  </div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GOLD, margin: 0 }}>{isMobile ? "Restrições identificadas no roteiro" : "Restrições identificadas no seu roteiro"}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {bullets.map((b, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 5, height: 5, borderRadius: 3, background: "#F59E0B", marginTop: 7, flexShrink: 0 }} />
                      <p style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.45, color: BODY, margin: 0 }}>{b}</p>
                    </div>
                  ))}
                </div>
                <div style={{ border: `1px solid ${GOLD_BORDER}`, background: "#FEF3C7", borderRadius: 6, padding: "8px 12px" }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>Escolha abaixo a opção que melhor se adapta ao seu ritmo de viagem.</p>
                </div>
              </div>

              {/* partidas */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 18 : 20, color: TEXT, margin: 0 }}>Partidas disponíveis no seu período</p>
                {trip.games.map((f, i) => {
                  const place = [f.city, f.country].filter((v, idx, arr) => v && arr.indexOf(v) === idx).join(", ");
                  const logoSize = isMobile ? 24 : 28;
                  return (
                    <div key={f.id ?? i} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? 14 : "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                      {/* topo: data (+ selo de clássico) */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 6, padding: "4px 10px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: GREEN }}>{formatDateBadge(f.date)}</span>
                        {f.rivalry && <Badge gold>{f.rivalry}</Badge>}
                      </div>
                      {/* times: cada escudo ao lado do nome do SEU time */}
                      <div style={{ display: "flex", gap: isMobile ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                          <TeamBadge name={f.home} url={f.homeLogo} size={logoSize} resolve />
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 16 : 18, color: TEXT, margin: 0 }}>{teamLabel(f.home)}</p>
                        </div>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 13 : 14, color: MUTED, margin: 0 }}>VS</p>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                          <TeamBadge name={f.away} url={f.awayLogo} size={logoSize} resolve />
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 16 : 18, color: TEXT, margin: 0 }}>{teamLabel(f.away)}</p>
                        </div>
                      </div>
                      {/* estádio: só o nome, com o ícone de estádio do projeto */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <Icon name="stadium" size={14} color={MUTED} />
                        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: BODY, margin: 0 }}>{f.stadium}</p>
                        {f.approxLocation && <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>Local provável — confirme o estádio</p>}
                      </div>
                      {/* rodapé: cidade, país à esquerda; competição à direita */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        {place ? <span style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 10px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: BODY }}>{place}</span> : <span />}
                        {f.competition && <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0, textAlign: "right" }}>{f.competition}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* opções A / B / C */}
              <div id="opcoes-roteiro" style={{ display: "flex", flexDirection: "column", gap: 16, scrollMarginTop: 24 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 20 : 28, color: TEXT, margin: 0 }}>Escolha sua opção de roteiro</p>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.45, color: MUTED, margin: 0 }}>Compare duração, partidas incluídas e deslocamentos antes de escolher.</p>
                </div>
                {isMobile && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {options.map((o) => (
                      <div key={o.key} onClick={() => setViewKey(o.key)} style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 999, cursor: "pointer", background: visibleKey === o.key ? GREEN : "#fff", border: `1px solid ${visibleKey === o.key ? GREEN : BORDER}` }}>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: visibleKey === o.key ? "#fff" : TEXT, margin: 0 }}>Opção {o.key}{chosenOption === o.key ? " ✓" : ""}</p>
                      </div>
                    ))}
                  </div>
                )}
                {options
                  .filter((o) => !isMobile || o.key === visibleKey)
                  .map((o) => (
                    <OptionCard key={o.key} opt={o} chosen={chosenOption === o.key} onChoose={handleChoose} isMobile={isMobile} />
                  ))}
              </div>
            </>
          )}

          {isMobile && hasContent && consultoria}
        </div>

        {!isMobile && hasContent && (
          <div style={{ width: 360, flexShrink: 0, display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 24 }}>
            {summary}
            {consultoria}
          </div>
        )}
      </div>
      {onBack && isMobile && (
        <div style={{ padding: "0 16px 24px" }}>
          <div onClick={onBack} style={{ border: `1px solid ${BORDER}`, background: "#fff", padding: "12px 20px", borderRadius: 8, cursor: "pointer", textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>← Voltar para meus roteiros</p>
          </div>
        </div>
      )}
      <AuthedFooter />
    </div>
  );
}

/** Logo depois do questionário. */
export function ResultadoRoteiro({ trip, options, chosenOption, onChooseOption, planLoading, planError, onRetryPlan, onHireConsultoria, onNavigate, onLogout }) {
  return (
    <RoteiroView
      trip={trip}
      options={options}
      chosenOption={chosenOption}
      onChooseOption={onChooseOption}
      planLoading={planLoading}
      planError={planError}
      onRetryPlan={onRetryPlan}
      onHireConsultoria={onHireConsultoria}
      onNavigate={onNavigate}
      onLogout={onLogout}
      onBack={() => onNavigate("roteiros")}
    />
  );
}

/** Roteiro salvo, aberto pela Biblioteca. */
export function RoteiroDetalhe({ trip, options, chosenOption, onChooseOption, planLoading, planError, onRetryPlan, onNavigate, onLogout, onBackToRoteiros, onHireConsultoria }) {
  return (
    <RoteiroView
      trip={trip}
      options={options}
      chosenOption={chosenOption}
      onChooseOption={onChooseOption}
      planLoading={planLoading}
      planError={planError}
      onRetryPlan={onRetryPlan}
      onHireConsultoria={onHireConsultoria}
      onNavigate={onNavigate}
      onLogout={onLogout}
      onBack={onBackToRoteiros}
    />
  );
}
