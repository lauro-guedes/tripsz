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
import { useState, useMemo, useEffect, useRef } from "react";
import { Globe, Check, Calendar, AlertTriangle, Shield, Info, CreditCard, Lock, Lightbulb, Eye, EyeOff, X, QrCode, Receipt, Award, Clipboard, BarChart2, TrendingUp, Star, Share2, MapPin, AlertCircle, Trophy, Download, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { supabaseBrowser } from "../lib/supabase";
import { GREEN, GREEN_BUTTON, GREEN_BUTTON2, GREEN_BG, GOLD, GOLD_BG, GOLD_BORDER, BG, BG_ALT, BORDER, TEXT, BODY, MUTED, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../lib/tokens";
import { initials } from "../lib/textUtils";
import { seasonOptionGroups, parseSeasonValue, gameSeason, compareSeasonsDesc } from "../lib/seasons";
import { buildOptions, durationRange } from "../lib/tripOptions";
import TeamBadge from "./TeamBadge";
import { TOURNAMENTS, hasMainTournament } from "../lib/competitionBadges";
import { authFetch } from "../lib/authFetch";
import { parseFutbologyLine, guessCountryFromCompetition } from "../lib/futbologyParse";
import { paceRangeLabel } from "../lib/paceRules";
import { todayInSaoPaulo, kickoffParts, formatLongDate, monthName, monthTitle, shiftMonth, buildMonthGrid, cityWithoutCountry, cityShortName, RADIUS_OPTIONS, WEEKDAY_HEADERS } from "../lib/calendarUtils";
import { initMercadoPago, createCardToken, CardNumber, SecurityCode, ExpirationDate } from "@mercadopago/sdk-react";


// Detecta telas estreitas (celular) e reage a mudanças de tamanho/rotação,
// pra todo componente poder alternar entre o layout desktop (Figma 95:*) e
// o layout mobile (Figma 125:*) sem precisar de dois arquivos separados.
function useIsMobile() {
  // Sempre começa como "desktop" (false), igual ao que o servidor
  // renderiza — ele não tem como saber o tamanho da tela de ninguém.
  // O valor real só é aplicado depois, dentro do useEffect (que só roda
  // no navegador, depois que a página já "bateu" com o servidor). Sem
  // isso, num navegador estreito, a primeira renderização do cliente já
  // vinha diferente da do servidor, e o React travava com um erro de
  // hidratação (#418/#423/#425) — que podia deixar a página inteira,
  // incluindo botões, sem funcionar.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

// Barra de progresso "Passo X de 5 / Y% Concluído" usada no topo de cada
// tela do questionário no mobile (Figma 125:129, 125:196, 125:252, etc.),
// substituindo os 5 círculos numerados do desktop, que não cabem numa tela estreita.
function MobileProgress({ step, total = WIZARD_TOTAL }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Passo {step} de {total}</p>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, margin: 0 }}>{pct}% Concluído</p>
      </div>
      <div style={{ background: BORDER, height: 6, borderRadius: 100, width: "100%", overflow: "hidden" }}>
        <div style={{ background: GREEN_BUTTON, height: "100%", width: `${pct}%`, borderRadius: 100 }} />
      </div>
    </div>
  );
}

function FontImports() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Lora:ital@0;1&family=JetBrains+Mono:wght@400;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      /* Trava contra a tela "sambar": mesmo que algum elemento fique mais
         largo que o celular, a página não anda pro lado nem faz o efeito
         de elástico. "clip" não cria uma área de rolagem própria, então a
         rolagem vertical e o window.scrollTo continuam normais. */
      html, body { max-width: 100%; overscroll-behavior-x: none; }
      body { overflow-x: hidden; overflow-wrap: break-word; }
      @supports (overflow: clip) { html, body { overflow-x: clip; } }
      img { max-width: 100%; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes tripsz-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(0.94); } }
    `}</style>
  );
}

/* Estado de carregamento padrão: símbolo da Tripsz + texto, centralizados. */
function Loading({ text = "Carregando...", compact = false, style }) {
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: compact ? 10 : 16, padding: compact ? "20px 0" : "80px 24px", width: "100%", boxSizing: "border-box", ...style }}>
      <img src="/simbolo-tripsz.svg" alt="" width={compact ? 38 : 56} height={compact ? 32 : 48} style={{ display: "block", animation: "tripsz-pulse 1.4s ease-in-out infinite" }} />
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: compact ? 13 : 14, color: MUTED, margin: 0, textAlign: "center" }}>{text}</p>
    </div>
  );
}

/* ---- Real icon path data you uploaded, recolored per use ---- */
const RAW_ICONS = {
  stadium: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 3L1 5V1L5 3ZM16 1V5L20 3L16 1ZM9 0V4L13 2L9 0ZM11 16H9V20C3.95 19.85 0 18.56 0 17V8C0 6.34 4.48 5 10 5C15.52 5 20 6.34 20 8V17C20 18.56 16.05 19.85 11 20V16ZM3 8.04C4.38 8.53 6.77 9 10 9C13.23 9 15.62 8.53 17 8.04C17 7.86 14.22 7 10 7C5.78 7 3 7.86 3 8.04ZM18 9.8C16.18 10.53 13.27 11 10 11C6.73 11 3.82 10.53 2 9.8V16.58C2.61 16.99 4.36 17.59 7 17.86V14H13V17.86C15.64 17.59 17.39 16.99 18 16.58V9.8Z" fill="COLOR"/></svg>`,
  arrowRight: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M3.3328 7.99996H12.6672M8 12.6672L12.6672 7.99996L8 3.33276" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  circleX: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"> <g clip-path="url(#clip0_2_578)"> <path d="M12.5002 7.49978L7.49982 12.5002M7.49982 7.49978L12.5002 12.5002M18.334 9.99998C18.334 14.6027 14.6028 18.334 10 18.334C5.39727 18.334 1.66602 14.6027 1.66602 9.99998C1.66602 5.39724 5.39727 1.66599 10 1.66599C14.6028 1.66599 18.334 5.39724 18.334 9.99998Z" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </g> </svg>`,
  lockKeyhole: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M9.33333 13.333V9.33273C9.33333 7.56448 10.0357 5.86865 11.286 4.61831C12.5362 3.36796 14.2319 2.66553 16 2.66553C17.7681 2.66553 19.4638 3.36796 20.714 4.61831C21.9643 5.86865 22.6667 7.56448 22.6667 9.33273V13.333M17.3333 21.3337C17.3333 22.0701 16.7364 22.6671 16 22.6671C15.2636 22.6671 14.6667 22.0701 14.6667 21.3337C14.6667 20.5972 15.2636 20.0002 16 20.0002C16.7364 20.0002 17.3333 20.5972 17.3333 21.3337ZM6.66667 13.333H25.3333C26.8061 13.333 28 14.5271 28 15.9999V26.6674C28 28.1403 26.8061 29.3343 25.3333 29.3343H6.66667C5.19391 29.3343 4 28.1403 4 26.6674V15.9999C4 14.5271 5.19391 13.333 6.66667 13.333Z" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  shieldCheck: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M7.50025 9.99962L9.16675 11.6663L12.4997 8.3329M16.666 10.8334C16.666 15.0002 13.7496 17.0836 10.2833 18.2919C10.1018 18.3534 9.90462 18.3505 9.72503 18.2836C6.25037 17.0836 3.334 15.0002 3.334 10.8334V4.99983C3.334 4.77881 3.42179 4.56684 3.57805 4.41056C3.73432 4.25427 3.94626 4.16647 4.16725 4.16647C5.83375 4.16647 7.91687 3.16644 9.36673 1.89973C9.54326 1.74889 9.76782 1.66602 10 1.66602C10.2322 1.66602 10.4567 1.74889 10.6333 1.89973C12.0915 3.17477 14.1662 4.16647 15.8327 4.16647C16.0537 4.16647 16.2657 4.25427 16.4219 4.41056C16.5782 4.56684 16.666 4.77881 16.666 4.99983V10.8334Z" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  binoculars: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M9.99985 10H14.0002M19.0006 7V4C19.0006 3.73478 18.8952 3.48043 18.7077 3.29289C18.5201 3.10536 18.2657 3 18.0005 3H16.0003C15.7351 3 15.4807 3.10536 15.2932 3.29289C15.1056 3.48043 15.0002 3.73478 15.0002 4V7M19.0006 7C19.2658 7 19.5202 7.10536 19.7077 7.29289C19.8953 7.48043 20.0006 7.73478 20.0006 8V10.32C20.0006 12.187 22.0008 13.759 22.0008 15.149V19C22.0008 19.5304 21.7901 20.0391 21.415 20.4142C21.0399 20.7893 20.5311 21 20.0006 21H16.0003C15.4699 21 14.9611 20.7893 14.586 20.4142C14.2109 20.0391 14.0002 19.5304 14.0002 19V8C14.0002 7.73478 14.1055 7.48043 14.2931 7.29289C14.4806 7.10536 14.735 7 15.0002 7M19.0006 7H15.0002M22.0008 16H1.99921M8.99977 7H4.99945C4.73421 7 4.47983 7.10536 4.29228 7.29289C4.10473 7.48043 3.99937 7.73478 3.99937 8V10.32C3.99937 12.187 1.99921 13.759 1.99921 15.149V19C1.99921 19.5304 2.20994 20.0391 2.58504 20.4142C2.96014 20.7893 3.46889 21 3.99937 21H7.99969C8.53016 21 9.03891 20.7893 9.41401 20.4142C9.78912 20.0391 9.99985 19.5304 9.99985 19V8C9.99985 7.73478 9.89448 7.48043 9.70693 7.29289C9.51938 7.10536 9.265 7 8.99977 7ZM4.99945 7V4C4.99945 3.73478 5.10481 3.48043 5.29236 3.29289C5.47991 3.10536 5.73429 3 5.99953 3H7.99969C8.26492 3 8.5193 3.10536 8.70685 3.29289C8.8944 3.48043 8.99977 3.73478 8.99977 4V7" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  flame: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M16.0005 9.50027C14.0002 7.83354 12.6667 5.66678 12 3C10.3331 4.33339 9.49972 5.66678 9.49972 7.00017C9.49972 9.00025 10.9999 10.0003 10.9999 12.0004C10.9999 12.6634 10.7365 13.2994 10.2676 13.7682C9.79868 14.2371 9.16272 14.5005 8.49961 14.5005C7.83649 14.5005 7.20053 14.2371 6.73164 13.7682C6.26274 13.2994 5.99932 12.6634 5.99932 12.0004C5.35014 12.8659 4.99921 13.9186 4.99921 15.0005C4.99921 16.8571 5.73679 18.6377 7.04969 19.9505C8.3626 21.2633 10.1433 22.0008 12 22.0008C13.8567 22.0008 15.6374 21.2633 16.9503 19.9505C18.2632 18.6377 19.0008 16.8571 19.0008 15.0005C19.0008 13.0004 18.0007 11.167 16.0005 9.50027Z" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  compass: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M12 22.0007C17.5233 22.0007 22.0008 17.5232 22.0008 11.9999C22.0008 6.47666 17.5233 1.99915 12 1.99915C6.47672 1.99915 1.99921 6.47666 1.99921 11.9999C1.99921 17.5232 6.47672 22.0007 12 22.0007Z" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  chevronDown: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M4 6L8 10L12 6" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  chevronRight: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M6 4L10 8L6 12" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  pen: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M22.0008 4.81839C22.0007 5.56599 21.7036 6.28294 21.1749 6.8115L7.82666 20.1603C7.59481 20.3914 7.30978 20.562 6.99659 20.6573L2.6432 21.9772C2.55675 22.0032 2.46488 22.0053 2.37733 21.9833C2.28979 21.9613 2.20983 21.916 2.14595 21.8522C2.08207 21.7885 2.03664 21.7086 2.01449 21.6211C1.99234 21.5336 1.9943 21.4417 2.02014 21.3553L3.34126 17.0033C3.43738 16.6899 3.6091 16.4048 3.84131 16.1733L17.1885 2.82457C17.7173 2.29601 18.4343 1.99911 19.182 1.99921C19.9297 1.9993 20.6467 2.29637 21.1754 2.82507C21.704 3.35377 22.0009 4.07079 22.0008 4.81839Z" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  soccerBall: `<svg width="24" height="24" viewBox="4 4 26 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 10.25C18.0716 10.25 16.1866 10.8218 14.5832 11.8932C12.9798 12.9645 11.7301 14.4873 10.9922 16.2688C10.2542 18.0504 10.0611 20.0108 10.4373 21.9021C10.8136 23.7934 11.7422 25.5307 13.1057 26.8943C14.4693 28.2579 16.2066 29.1865 18.0979 29.5627C19.9892 29.9389 21.9496 29.7458 23.7312 29.0078C25.5127 28.2699 27.0355 27.0202 28.1068 25.4168C29.1782 23.8134 29.75 21.9284 29.75 20C29.7473 17.415 28.7192 14.9366 26.8913 13.1087C25.0634 11.2808 22.585 10.2527 20 10.25ZM20.75 13.9419L23.0741 12.3434C24.4047 12.8794 25.5734 13.7516 26.4659 14.8747L25.7159 17.4003C25.6972 17.4003 25.6775 17.4097 25.6588 17.4163L23.5194 18.1109C23.4873 18.1213 23.456 18.1338 23.4256 18.1484L20.75 16.3081V13.9419ZM16.9288 12.3434L19.25 13.9419V16.3081L16.5725 18.1522C16.5421 18.1376 16.5108 18.1251 16.4788 18.1147L14.3394 17.42C14.3206 17.4134 14.3009 17.4087 14.2822 17.4041L13.5322 14.8784C14.4255 13.7533 15.596 12.8798 16.9288 12.3434ZM15.71 24.4456H13.0531C12.2754 23.2364 11.8295 21.8439 11.7603 20.4078L13.8228 18.8253C13.8406 18.8331 13.8587 18.84 13.8772 18.8459L16.0175 19.5416C16.0461 19.5502 16.0752 19.5571 16.1047 19.5622L17.1163 22.5078C17.1022 22.5247 17.0881 22.5416 17.075 22.5594L15.7531 24.3791C15.7376 24.4005 15.7232 24.4227 15.71 24.4456ZM22.1272 27.9688C20.7334 28.34 19.2666 28.34 17.8728 27.9688L16.9297 25.3063C16.9419 25.2913 16.955 25.2772 16.9663 25.2612L18.2891 23.4406C18.3046 23.4195 18.319 23.3976 18.3322 23.375H21.6678C21.681 23.3976 21.6954 23.4195 21.7109 23.4406L23.0338 25.2612C23.045 25.2772 23.0581 25.2913 23.0703 25.3063L22.1272 27.9688ZM24.29 24.4428C24.2768 24.4199 24.2624 24.3977 24.2469 24.3762L22.9241 22.5594C22.9109 22.5416 22.8969 22.5247 22.8828 22.5078L23.8944 19.5622C23.9238 19.5571 23.9529 19.5502 23.9816 19.5416L26.1219 18.8459C26.1403 18.84 26.1585 18.8331 26.1763 18.8253L28.2388 20.4078C28.1695 21.8439 27.7237 23.2364 26.9459 24.4456L24.29 24.4428Z" fill="COLOR"/></svg>`,
  shieldBadge: `<svg width="24" height="24" viewBox="9 9 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M28.342 16.4468L29.447 15.8938C29.5782 15.8285 29.6935 15.7352 29.7845 15.6204C29.8756 15.5056 29.9403 15.3722 29.974 15.2296C30.0077 15.087 30.0096 14.9387 29.9795 14.7953C29.9494 14.6519 29.8881 14.5168 29.8 14.3998L26.8 10.3998C26.7069 10.2756 26.5861 10.1748 26.4472 10.1053C26.3084 10.0359 26.1552 9.99976 26 9.99976H14C13.8448 9.99976 13.6916 10.0359 13.5528 10.1053C13.4139 10.1748 13.2931 10.2756 13.2 10.3998L10.2 14.3998C10.1122 14.5169 10.0511 14.6518 10.0212 14.7951C9.99122 14.9384 9.9931 15.0866 10.0267 15.2291C10.0602 15.3716 10.1247 15.5049 10.2155 15.6198C10.3062 15.7346 10.4211 15.8282 10.552 15.8938L11.657 16.4468L10.526 18.7088C10.1814 19.4035 10.0014 20.1683 10 20.9438V21.5348C10.0043 22.7552 10.3788 23.9457 11.0741 24.9488C11.7693 25.9519 12.7526 26.7204 13.894 27.1528L17.325 28.4388C18.0648 28.7152 18.7363 29.1476 19.294 29.7068C19.3866 29.7998 19.4967 29.8736 19.618 29.924C19.7392 29.9744 19.8692 30.0003 20.0005 30.0003C20.1318 30.0003 20.2618 29.9744 20.383 29.924C20.5043 29.8736 20.6144 29.7998 20.707 29.7068C21.2648 29.148 21.9363 28.7159 22.676 28.4398L26.108 27.1528C27.249 26.7201 28.2319 25.9515 28.9268 24.9484C29.6217 23.9453 29.9959 22.755 30 21.5348V20.9438C30 20.1728 29.817 19.3988 29.473 18.7078L28.342 16.4468ZM28 21.5348C27.9971 22.3484 27.7474 23.1419 27.2839 23.8106C26.8204 24.4793 26.1649 24.9916 25.404 25.2798L21.973 26.5668C21.2632 26.8319 20.5976 27.2031 19.999 27.6678C19.4005 27.2028 18.7349 26.8312 18.025 26.5658L14.596 25.2798C13.8351 24.9916 13.1796 24.4793 12.7161 23.8106C12.2526 23.1419 12.0029 22.3484 12 21.5348V20.9438C12 20.4808 12.109 20.0158 12.316 19.6018L13.447 17.3408C13.6836 16.866 13.7222 16.3169 13.5544 15.8137C13.3867 15.3105 13.0261 14.8945 12.552 14.6568L12.519 14.6418L14.5 11.9998H25.5L27.481 14.6418L27.447 14.6588C26.973 14.8967 26.6127 15.3128 26.445 15.8158C26.2772 16.3189 26.3157 16.868 26.552 17.3428L27.683 19.6028C27.891 20.0168 28 20.4808 28 20.9438V21.5348Z" fill="COLOR"/></svg>`,
  fileText: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M13.9998 1.99921H6.00059C5.47021 1.99921 4.96156 2.20994 4.58652 2.58504C4.21149 2.96015 4.00079 3.46889 4.00079 3.99937V20.0006C4.00079 20.5311 4.21149 21.0399 4.58652 21.415C4.96156 21.7901 5.47021 22.0008 6.00059 22.0008H17.9994C18.5298 22.0008 19.0384 21.7901 19.4135 21.415C19.7885 21.0399 19.9992 20.5311 19.9992 20.0006V7.99969M13.9998 1.99921C14.3163 1.9987 14.6298 2.06082 14.9222 2.18199C15.2146 2.30317 15.4802 2.48101 15.7036 2.70527L19.2913 6.29355C19.5161 6.51708 19.6944 6.78294 19.8159 7.07578C19.9374 7.36862 19.9997 7.68263 19.9992 7.99969M13.9998 1.99921V6.99961C13.9998 7.26484 14.1051 7.51922 14.2927 7.70677C14.4802 7.89432 14.7345 7.99969 14.9997 7.99969L19.9992 7.99969M10.0002 8.99977H8.00039M15.9996 13.0001H8.00039M15.9996 17.0004H8.00039" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  planeTakeoff: `<svg width="24" height="24" viewBox="10 10 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M26.212 14.271L22.544 16.512L15.597 15.677C15.1712 15.644 14.7446 15.7302 14.365 15.926L13.252 16.575L18.514 18.735L13.768 21.546L12.364 21.346C11.856 21.2068 11.3138 21.2695 10.851 21.521L10 22L13.47 24.044L19.644 22.724L30 16.687L28.972 14.97C28.442 14.047 27.202 13.715 26.212 14.271ZM14 27H26" stroke="COLOR" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  google: `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.825.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/></svg>`,
  search: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M9.16667 16.6667C13.3088 16.6667 16.6667 13.3088 16.6667 9.16667C16.6667 5.02453 13.3088 1.66667 9.16667 1.66667C5.02453 1.66667 1.66667 5.02453 1.66667 9.16667C1.66667 13.3088 5.02453 16.6667 9.16667 16.6667Z" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> <path d="M18.3333 18.3333L14.1667 14.1667" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  globe: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M12 22.0008C17.5228 22.0008 22 17.5236 22 12.0008C22 6.47792 17.5228 2.00076 12 2.00076C6.47715 2.00076 2 6.47792 2 12.0008C2 17.5236 6.47715 22.0008 12 22.0008Z" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> <path d="M2 12.0008H22" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> <path d="M12 2.00076C14.5013 4.73866 15.9228 8.29331 16 12.0008C15.9228 15.7082 14.5013 19.2629 12 22.0008C9.49872 19.2629 8.07725 15.7082 8 12.0008C8.07725 8.29331 9.49872 4.73866 12 2.00076Z" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  mapPin: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" stroke="COLOR" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> <circle cx="12" cy="10" r="3" stroke="COLOR" stroke-width="2"/> </svg>`,
  trophy: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M6 9H4.5A2.5 2.5 0 012 6.5V5a1 1 0 011-1h3" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> <path d="M18 9h1.5A2.5 2.5 0 0022 6.5V5a1 1 0 00-1-1h-3" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> <path d="M6 4h12v6a6 6 0 01-12 0V4z" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> <path d="M12 16v4M8 22h8" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  crown: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M3 18h18M4 18l-1-10 5 4 4-7 4 7 5-4-1 10" stroke="COLOR" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </svg>`,
  ticket: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V8z" stroke="COLOR" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> <path d="M13 5v2M13 11v2M13 17v2" stroke="COLOR" stroke-width="2" stroke-linecap="round"/> </svg>`,
  sofa: `<svg width="24" height="18" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M21 5V3C21 1.35 19.65 0 18 0H14C13.23 0 12.53 0.3 12 0.78C11.47 0.3 10.77 0 10 0H6C4.35 0 3 1.35 3 3V5C1.35 5 0 6.35 0 8V13C0 14.65 1.35 16 3 16V18H5V16H19V18H21V16C22.65 16 24 14.65 24 13V8C24 6.35 22.65 5 21 5ZM14 2H18C18.55 2 19 2.45 19 3V5.78C18.39 6.33 18 7.12 18 8V10H13V3C13 2.45 13.45 2 14 2ZM5 3C5 2.45 5.45 2 6 2H10C10.55 2 11 2.45 11 3V10H6V8C6 7.12 5.61 6.33 5 5.78V3ZM22 13C22 13.55 21.55 14 21 14H3C2.45 14 2 13.55 2 13V8C2 7.45 2.45 7 3 7C3.55 7 4 7.45 4 8V12H20V8C20 7.45 20.45 7 21 7C21.55 7 22 7.45 22 8V13Z" fill="COLOR"/> </svg>`,
};

function Icon({ name, size, color, style }) {
  const html = RAW_ICONS[name].replaceAll("COLOR", color).replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
  return <span style={{ display: "inline-flex", width: size, height: size, flexShrink: 0, ...style }} dangerouslySetInnerHTML={{ __html: html }} />;
}

const PHOTO_HERO = "/foto-hero.jpg";

const PHOTO_FINALCTA = "/foto-cta-final.jpg";

// A logo é um ARQUIVO (public/logo-tripsz.svg, proporção 123x34): pra trocar
// a logo no site inteiro, é só trocar esse arquivo — não precisa mexer aqui.
function Wordmark({ onClick, height = 34 }) {
  return (
    <img
      src="/logo-tripsz.svg"
      alt="tripsz"
      width={(123 / 34) * height}
      height={height}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", flexShrink: 0 }}
    />
  );
}

function Badge({ children, gold }) {
  return (
    <div style={{ background: gold ? GOLD_BG : GREEN_BG, border: `1px solid ${gold ? GOLD_BORDER : GREEN}`, display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 4 }}>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: gold ? GOLD : GREEN, textTransform: "uppercase", margin: 0, whiteSpace: "nowrap" }}>{children}</p>
    </div>
  );
}

function Button({ children, icon, variant = "primary", onClick, small }) {
  const styles = {
    primary: { background: GREEN_BUTTON, color: TEXT, border: "none" },
    primaryDark: { background: GREEN, color: "#fff", border: "none" },
    secondary: { background: "#fff", color: TEXT, border: `1px solid ${BORDER}` },
    secondaryMuted: { background: "#fff", color: MUTED, border: `1px solid ${BORDER}` },
    outline: { background: "#fff", color: GREEN, border: `1.5px solid ${GREEN}` },
  };
  return (
    <div onClick={onClick} style={{ display: "inline-flex", gap: 8, alignItems: "center", justifyContent: "center", padding: small ? "10px 20px" : "14px 24px", borderRadius: 8, cursor: "pointer", ...styles[variant] }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: small ? 13 : 14, textTransform: "uppercase", margin: 0, whiteSpace: "nowrap" }}>{children}</p>
      {icon}
    </div>
  );
}

function TopNavPublic({ onStart, active, onLogin, onHome, onNavItem }) {
  const isMobile = useIsMobile();
  const items = [
    ["Como Funciona", "como-funciona"],
    ["Roteiros", "pricing"],
    ["Diferenciais", "diferenciais"],
    ["FAQ", "faq"],
  ];
  const handleNavItem = (id) => {
    if (onNavItem) onNavItem(id);
  };
  if (isMobile) {
    return (
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <Wordmark height={28} onClick={onHome} />
        {onLogin ? (
          <div onClick={onLogin} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: TEXT, textTransform: "uppercase", margin: 0 }}>Entrar ou Criar Conta</p>
          </div>
        ) : (
          <div onClick={onStart} style={{ background: GREEN_BUTTON, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: TEXT, textTransform: "uppercase", margin: 0 }}>Montar viagem</p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 80px" }}>
      <Wordmark onClick={onHome} />
      <div style={{ display: "flex", gap: 40, alignItems: "center", fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14 }}>
        {items.map(([label, id]) => (
          <p key={id} onClick={() => handleNavItem(id)} style={{ color: label === active ? GREEN : MUTED, fontWeight: label === active ? 700 : 500, margin: 0, cursor: "pointer" }}>{label}</p>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {onLogin && (
          <div onClick={onLogin} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>Entrar ou Criar Conta</p>
          </div>
        )}
        <Button variant="primaryDark" onClick={onStart}>Montar minha viagem</Button>
      </div>
    </div>
  );
}

/* Shared wizard chrome */
const WIZARD_TOTAL = 6;

function WizardTopBar({ step, onExit, onLogoClick, total = WIZARD_TOTAL }) {
  const isMobile = useIsMobile();
  const pct = Math.round((step / total) * 100);
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "flex-start", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", width: "100%", background: "#fff" }}>
          <Wordmark height={26} onClick={onLogoClick} />
          <p onClick={onExit} style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, cursor: "pointer", margin: 0 }}>Sair</p>
        </div>
        <div style={{ height: 1, background: BORDER, width: "100%" }} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "flex-start", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 80px", width: "100%" }}>
        <Wordmark onClick={onLogoClick} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", width: 360 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontFamily: FONT_MONO, fontSize: 12 }}>
            <span style={{ color: GREEN, textTransform: "uppercase" }}>Passo {step} de {total}</span>
            <span style={{ color: MUTED }}>{pct}% Concluído</span>
          </div>
          <div style={{ width: "100%", height: 4, borderRadius: 2, background: BORDER, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: GREEN_BUTTON }} />
          </div>
        </div>
        <p onClick={onExit} style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, cursor: "pointer", margin: 0 }}>Sair do questionário</p>
      </div>
      <div style={{ height: 1, background: BORDER, width: "100%" }} />
    </div>
  );
}

function WizardBottomBar({ onBack, onNext, nextLabel = "Continuar", mutedBack }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ width: "100%" }}>
      <div style={{ height: 1, background: BORDER, width: "100%" }} />
      <div style={{ background: BG_ALT, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "16px" : "24px 80px", width: "100%" }}>
        <div onClick={onBack} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "12px 20px" : "14px 24px", borderRadius: 8, cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 13 : 14, color: mutedBack ? MUTED : TEXT, textTransform: "uppercase", margin: 0 }}>Voltar</p>
        </div>
        <div onClick={onNext} style={{ background: GREEN_BUTTON, display: "flex", gap: 6, alignItems: "center", justifyContent: "center", padding: isMobile ? "12px 24px" : "14px 24px", borderRadius: 8, cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 13 : 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{nextLabel}</p>
          <Icon name="arrowRight" size={isMobile ? 12 : 16} color={TEXT} />
        </div>
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <div onClick={onClick} style={{ background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "12px 16px", borderRadius: 6, cursor: "pointer" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: active ? GREEN : TEXT, margin: 0, whiteSpace: "nowrap" }}>{children}</p>
      {active && <Check size={14} color={GREEN} />}
    </div>
  );
}

/* ============================================================
   1. LANDING (node 91:2) — same as tripsz-landing-page.jsx
   ============================================================ */
const PHOTO_STADIUM = "/foto-estadio.jpg";

function LandingPage({ onStart, onSubscribe, onLogin }) {
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
    ["O que acontece com meu Passport se eu cancelar?", "Seus dados ficam salvos, mas o acesso ao Passport e badges fica pausado até reativar."],
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
      <div style={{ background: "#fff", padding: isMobile ? `48px ${px}` : `100px ${px}`, display: "flex", flexDirection: "column", gap: isMobile ? 32 : 64, alignItems: "center" }}>
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
            {[["stadium", "Estádios", "109 visitados"], ["award", "Conquistas", "10 badges"], ["trophy", "Progresso", "158 jogos"]].map(([iconKey, label, value]) => (
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
      <div style={{ background: BG, padding: isMobile ? `48px ${px}` : `100px ${px}`, display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48 }}>
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
              {[["Criação de roteiros ilimitados", true], ["Busca por jogos em 13 países", true], ["Football Passport (até 20 jogos)", true], ["Níveis, badges e ranking", true], ["Perfil público compartilhável", true], ["Mais de 20 jogos registrados", false], ["Importação em massa (Futbology)", false], ["Desconto em consultorias", false]].map(([label, ok]) => (
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

/* ============================================================
   2. CRIAR CONTA (node 95:489)
   ============================================================ */
/* --- Modal de login independente — funciona sobre QUALQUER tela (landing,
   questionário etc), sem precisar trocar a tela de fundo pra "account". --- */
function CriteriaDot({ ok, label }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
      <div style={{ width: 6, height: 6, borderRadius: 3, background: ok ? GREEN : BORDER, flexShrink: 0 }} />
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: ok ? GREEN : MUTED, margin: 0 }}>{label}</p>
    </div>
  );
}

function CriarConta({ onDone, onLogin, onHome }) {
  const isMobile = useIsMobile();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatWhatsapp = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.replace(/^(\d*)/, "($1");
    if (digits.length <= 7) return digits.replace(/^(\d{2})(\d*)/, "($1) $2");
    return digits.replace(/^(\d{2})(\d{5})(\d*)/, "($1) $2-$3");
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passChecks = { upper: /[A-Z]/.test(password), lower: /[a-z]/.test(password), len: password.length >= 8 };
  const passwordValid = passChecks.upper && passChecks.lower && passChecks.len;
  const confirmValid = passwordConfirm === password && password.length > 0;
  const nameValid = name.trim().length > 1;
  const whatsappDigits = whatsapp.replace(/\D/g, "");
  const whatsappValid = whatsappDigits.length === 10 || whatsappDigits.length === 11;

  const handleGoogleSignup = async () => {
    setError(null);
    const supabase = supabaseBrowser();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) setError(oauthError.message);
  };

  const handleCreateAccount = async () => {
    setError(null);
    if (!nameValid) return setError("Preencha seu nome completo.");
    if (!emailValid) return setError("Digite um e-mail válido.");
    if (!whatsappValid) return setError("Digite um WhatsApp válido, com DDD.");
    if (!passwordValid) return setError("A senha precisa atender aos critérios abaixo.");
    if (!confirmValid) return setError("As senhas não coincidem.");

    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, whatsapp } },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      onDone();
    } catch {
      setError("Não foi possível conectar com o servidor de contas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = {
    width: "100%", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
    height: 44, padding: "0 16px", fontFamily: FONT_BODY, fontSize: 16, color: TEXT, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", height: 80, padding: isMobile ? "0 16px" : "0 80px" }}>
        <Wordmark onClick={onHome} />
      </div>
      <div style={{ height: 1, background: BORDER, width: "100%" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: isMobile ? "32px 16px" : "48px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 36, color: TEXT, margin: 0, textAlign: "center" }}>Crie sua conta</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 16, color: BODY, margin: 0, textAlign: "center", maxWidth: 600 }}>Preencha os dados abaixo para criar sua conta.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: isMobile ? "100%" : 500 }}>
          <div onClick={handleGoogleSignup} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: 260, maxWidth: "100%", cursor: "pointer" }}>
            <Icon name="google" size={24} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>Entrar com Google</p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Já tem conta?</p>
            <p onClick={onLogin} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0, cursor: "pointer" }}>Entrar</p>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", width: "100%" }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>ou</p>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Cadastro</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Nome</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" style={fieldStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>E-mail</p>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" style={fieldStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>WhatsApp</p>
              <input value={whatsapp} onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))} placeholder="(99) 99999-9999" style={fieldStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Senha</p>
              <div style={{ position: "relative" }}>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Crie uma senha segura" style={{ ...fieldStyle, paddingRight: 48 }} />
                <div onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Confirmar senha</p>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateAccount(); }}
                  placeholder="Repita a senha"
                  style={{ ...fieldStyle, paddingRight: 48 }}
                />
                <div onClick={() => setShowConfirm((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: BODY, margin: 0 }}>Critérios da senha</p>
              <CriteriaDot ok={passChecks.upper} label="Pelo menos 1 letra maiúscula" />
              <CriteriaDot ok={passChecks.lower} label="Pelo menos 1 letra minúscula" />
              <CriteriaDot ok={passChecks.len} label="No mínimo 8 caracteres" />
            </div>

            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}

            <div onClick={loading ? undefined : handleCreateAccount} style={{ background: GREEN_BUTTON, opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: "100%", cursor: loading ? "default" : "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{loading ? "Criando conta..." : "Criar conta"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ onClose, onBackToLogin }) {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Digite seu e-mail.");
      return;
    }
    setSending(true);
    try {
      const supabase = supabaseBrowser();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (e) {
      // Por segurança, não confirmamos se o e-mail existe ou não na
      // base — sempre mostra sucesso, igual qualquer app sério faz.
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#0f172a", opacity: 0.56 }} />
      <div style={{ position: "relative", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, width: isMobile ? "calc(100% - 32px)" : 400, maxWidth: 400, display: "flex", flexDirection: "column", gap: 20, boxShadow: "0px 12px 16px rgba(15,23,42,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Redefinir senha</p>
          <div onClick={onClose} style={{ background: BG, border: `1px solid ${BORDER}`, width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} color={TEXT} />
          </div>
        </div>

        {sent ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, lineHeight: 1.5, color: BODY, margin: 0 }}>
              Se <strong>{email}</strong> estiver cadastrado, enviamos um link de redefinição de senha pra ele.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: MUTED, flexShrink: 0 }} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Verifique sua caixa de entrada e spam.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, lineHeight: "20px", color: MUTED, margin: 0, width: "100%" }}>
              Insira o e-mail cadastrado para receber um link de redefinição de senha.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>E-mail</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="nome@exemplo.com"
                style={{ width: "100%", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, height: 44, padding: "0 16px", fontFamily: FONT_BODY, fontSize: 16, color: TEXT, outline: "none" }}
              />
            </div>
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: MUTED, flexShrink: 0 }} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Verifique sua caixa de entrada e spam.</p>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", width: "100%" }}>
          {!sent && (
            <div onClick={sending ? undefined : handleSend} style={{ background: GREEN_BUTTON, opacity: sending ? 0.6 : 1, width: "100%", padding: "14px 24px", borderRadius: 12, textAlign: "center", cursor: sending ? "default" : "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{sending ? "Enviando..." : "Enviar link"}</p>
            </div>
          )}
          <p onClick={onBackToLogin} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, textAlign: "center", width: "100%", margin: 0, cursor: "pointer" }}>Voltar para login</p>
        </div>
      </div>
    </div>
  );
}

function LoginModal({ onClose, onCreateAccount }) {
  const isMobile = useIsMobile();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const fieldStyle = (invalid) => ({
    width: "100%",
    background: "#fff",
    border: `1px solid ${invalid ? "#dc2626" : BORDER}`,
    borderRadius: 12,
    height: 56,
    padding: "0 16px",
    fontFamily: FONT_BODY,
    fontSize: 16,
    color: TEXT,
    outline: "none",
  });

  const handleLogin = async () => {
    setLoginError(null);
    if (!loginEmail || !loginPassword) {
      setLoginError("Preencha e-mail e senha para continuar.");
      return;
    }
    setLoginLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error) {
        setLoginError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
        return;
      }
      onClose();
      // Não navega daqui de propósito: o listener de autenticação global
      // (em App()) já detecta esse login e decide pra onde ir, conforme
      // a intenção salva (Meus Roteiros, questionário etc).
    } catch (e) {
      setLoginError("Não foi possível conectar com o servidor de contas. Tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setLoginError(error.message);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#0f172a", opacity: 0.56 }} />
      <div style={{ position: "relative", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, width: isMobile ? "calc(100% - 32px)" : 400, maxWidth: 400, display: "flex", flexDirection: "column", gap: 20, boxShadow: "0px 12px 16px rgba(15,23,42,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Acesso</p>
          <div onClick={onClose} style={{ background: BG, border: `1px solid ${BORDER}`, width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} color={TEXT} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          <div onClick={handleGoogleLogin} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: "100%", cursor: "pointer" }}>
            <Icon name="google" size={20} color={TEXT} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Entrar com Google</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", width: "100%" }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>ou</p>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>E-mail</p>
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="nome@exemplo.com" style={fieldStyle(false)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Senha</p>
            <div style={{ position: "relative" }}>
              <input
                type={showLoginPassword ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                placeholder="••••••••"
                style={{ ...fieldStyle(false), paddingRight: 48 }}
              />
              <div onClick={() => setShowLoginPassword((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </div>
            </div>
          </div>
          {loginError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0, width: "100%" }}>{loginError}</p>}
          <p onClick={() => setShowResetModal(true)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#dc2626", margin: 0, cursor: "pointer" }}>Esqueci minha senha</p>
          {onCreateAccount && (
            <div style={{ display: "flex", gap: 8 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Não tem conta?</p>
              <p onClick={onCreateAccount} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0, cursor: "pointer" }}>Criar conta</p>
            </div>
          )}
        </div>

        <div onClick={loginLoading ? undefined : handleLogin} style={{ background: GREEN_BUTTON2, opacity: loginLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: "100%", cursor: loginLoading ? "default" : "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{loginLoading ? "Entrando..." : "Entrar"}</p>
        </div>
      </div>
      {showResetModal && <ResetPasswordModal onClose={() => setShowResetModal(false)} onBackToLogin={() => setShowResetModal(false)} />}
    </div>
  );
}

function StepAccount({ answers, setAnswers, onNext, onBack, openLogin }) {
  const set = (k, v) => setAnswers((a) => ({ ...a, [k]: v }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({});

  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  const formatWhatsapp = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.replace(/^(\d*)/, "($1");
    if (digits.length <= 7) return digits.replace(/^(\d{2})(\d*)/, "($1) $2");
    return digits.replace(/^(\d{2})(\d{5})(\d*)/, "($1) $2-$3");
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email || "");
  const password = answers.password || "";
  const passChecks = {
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    len: password.length >= 8,
  };
  const passwordValid = passChecks.upper && passChecks.lower && passChecks.len;
  const confirmValid = (answers.passwordConfirm || "") === password && password.length > 0;
  const nameValid = (answers.name || "").trim().length > 1;
  const whatsappDigits = (answers.whatsapp || "").replace(/\D/g, "");
  const whatsappValid = whatsappDigits.length === 10 || whatsappDigits.length === 11;

  const [showLoginModal, setShowLoginModal] = useState(!!openLogin);
  const isMobile = useIsMobile();

  const handleGoogleLogin = async () => {
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    // O Supabase redireciona pro Google e volta sozinho; o onAuthStateChange
    // no App() detecta a sessão e avança o passo automaticamente.
  };

  const handleCreateAccount = async () => {
    setError(null);
    setTouched({ name: true, email: true, whatsapp: true, password: true, passwordConfirm: true });

    if (!nameValid) return setError("Preencha seu nome completo.");
    if (!emailValid) return setError("Digite um e-mail válido.");
    if (!whatsappValid) return setError("Digite um WhatsApp válido, com DDD.");
    if (!passwordValid) return setError("A senha precisa atender aos critérios abaixo.");
    if (!confirmValid) return setError("As senhas não coincidem.");

    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase.auth.signUp({
        email: answers.email,
        password: answers.password,
        options: { data: { name: answers.name, whatsapp: answers.whatsapp } },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setAnswers((a) => ({ ...a, userId: data.user?.id }));
      onNext();
    } catch (e) {
      setError("Não foi possível conectar com o servidor de contas. Tente novamente.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = (invalid) => ({
    width: "100%",
    background: "#fff",
    border: `1px solid ${invalid ? "#dc2626" : BORDER}`,
    borderRadius: 12,
    height: 56,
    padding: "0 16px",
    fontFamily: FONT_BODY,
    fontSize: 16,
    color: TEXT,
    outline: "none",
  });

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 16px" : "24px 80px", width: "100%" }}>
          <Wordmark onClick={onBack} />
          <p onClick={onBack} style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 12 : 14, color: MUTED, cursor: "pointer", margin: 0 }}>{isMobile ? "Sair" : "Sair do questionário"}</p>
        </div>
        <div style={{ height: 1, background: BORDER, width: "100%" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 20 : 32, alignItems: "center", padding: isMobile ? "0 16px" : "0 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: "center", textAlign: "center" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Acesse sua conta</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 600, margin: 0, textAlign: "center" }}>Entre com o Google ou crie sua conta para continuar com o roteiro.</p>
        </div>

        {isMobile ? (
          <MobileProgress step={1} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: 800 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Passo 1 de {WIZARD_TOTAL}</p>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {Array.from({ length: WIZARD_TOTAL }, (_, i) => i + 1).map((n) => (
                  <div key={n} style={{ background: n === 1 ? GREEN_BUTTON2 : BORDER, width: 24, height: 24, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: n === 1 ? TEXT : MUTED, margin: 0 }}>{n}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>{Math.round((1 / WIZARD_TOTAL) * 100)}% Concluído</p>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24, alignItems: "center", width: isMobile ? "100%" : 800 }}>
          <div onClick={handleGoogleLogin} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: "100%", cursor: "pointer" }}>
            <Icon name="google" size={20} color={TEXT} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 13 : 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{isMobile ? "Cadastrar com Google" : "Entrar com Google"}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 12 : 14, color: MUTED, margin: 0 }}>Já tem conta?</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 12 : 14, color: GREEN, margin: 0, cursor: "pointer" }} onClick={() => { setLoginError(null); setShowLoginModal(true); }}>Entrar</p>
          </div>
          {error && (
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0, width: "100%" }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: 12, alignItems: "center", width: "100%" }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>ou</p>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", width: "100%" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Criar conta</p>

            {/* Nome */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Nome</p>
              <input
                type="text"
                value={answers.name || ""}
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => touch("name")}
                placeholder="Seu nome completo"
                style={fieldStyle(touched.name && !nameValid)}
              />
              {touched.name && !nameValid && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>Digite seu nome completo.</p>
              )}
            </div>

            {/* E-mail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>E-mail</p>
              <input
                type="email"
                value={answers.email || ""}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => touch("email")}
                placeholder="nome@exemplo.com"
                style={fieldStyle(touched.email && !emailValid)}
              />
              {touched.email && !emailValid && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>Digite um e-mail válido.</p>
              )}
            </div>

            {/* WhatsApp */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>WhatsApp</p>
              <input
                type="tel"
                inputMode="numeric"
                value={answers.whatsapp || ""}
                onChange={(e) => set("whatsapp", formatWhatsapp(e.target.value))}
                onBlur={() => touch("whatsapp")}
                placeholder="(99) 99999-9999"
                maxLength={15}
                style={fieldStyle(touched.whatsapp && !whatsappValid)}
              />
              {touched.whatsapp && !whatsappValid && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>Digite um WhatsApp válido, com DDD.</p>
              )}
            </div>

            {/* Senha */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Senha</p>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => set("password", e.target.value)}
                  onBlur={() => touch("password")}
                  placeholder="Crie uma senha segura"
                  style={{ ...fieldStyle(touched.password && !passwordValid), paddingRight: 48 }}
                />
                <div onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
              </div>
            </div>

            {/* Confirmar senha */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Confirmar senha</p>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={answers.passwordConfirm || ""}
                  onChange={(e) => set("passwordConfirm", e.target.value)}
                  onBlur={() => touch("passwordConfirm")}
                  placeholder="Repita a senha"
                  style={{ ...fieldStyle(touched.passwordConfirm && !confirmValid), paddingRight: 48 }}
                />
                <div onClick={() => setShowConfirm((v) => !v)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: MUTED, display: "flex" }}>
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
              </div>
              {touched.passwordConfirm && !confirmValid && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>As senhas não coincidem.</p>
              )}
            </div>

            {/* Critérios da senha */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: BODY, margin: 0 }}>Critérios da senha</p>
              <CriteriaDot ok={passChecks.upper} label="Pelo menos 1 letra maiúscula" />
              <CriteriaDot ok={passChecks.lower} label="Pelo menos 1 letra minúscula" />
              <CriteriaDot ok={passChecks.len} label="No mínimo 8 caracteres" />
            </div>

            <div onClick={handleCreateAccount} style={{ background: GREEN_BUTTON2, opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 12, width: "100%", cursor: loading ? "default" : "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{loading ? "Criando conta..." : "Criar conta"}</p>
            </div>
          </div>
        </div>
      </div>

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      <WizardBottomBar
        onBack={onBack}
        onNext={async () => {
          const supabase = supabaseBrowser();
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setError("Entre com Google ou crie sua conta antes de continuar.");
            return;
          }
          setAnswers((a) => ({ ...a, userId: data.session.user.id }));
          onNext();
        }}
      />
    </div>
  );
}

/* ============================================================
   3. DESTINO (node 95:419)
   ============================================================ */
const COUNTRIES_BY_CONTINENT = {
  eu: ["Inglaterra", "Espanha", "Itália", "Alemanha", "França", "Portugal", "Holanda", "Turquia"],
  sa: ["Argentina", "Brasil", "Uruguai", "Chile", "Colômbia"],
};

function StepDestino({ answers, setAnswers, onNext, onBack, onHome, stepOffset = 0 }) {
  const isMobile = useIsMobile();
  const continents = answers.continents || [];
  const countries = answers.countries || [];
  const [error, setError] = useState(null);
  const toggleContinent = (id) => setAnswers((a) => ({ ...a, continents: continents.includes(id) ? continents.filter((x) => x !== id) : [...continents, id] }));
  const toggleCountry = (c) => setAnswers((a) => ({ ...a, countries: countries.includes(c) ? countries.filter((x) => x !== c) : [...countries, c] }));
  const availableCountries = continents.flatMap((id) => COUNTRIES_BY_CONTINENT[id] || []);

  const handleNext = () => {
    if (countries.length === 0) {
      setError("Escolha ao menos um país antes de continuar.");
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <WizardTopBar step={2 - stepOffset} total={WIZARD_TOTAL - stepOffset} onExit={onBack} onLogoClick={onHome} />
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 40, alignItems: isMobile ? "flex-start" : "center", padding: isMobile ? "24px 16px" : "40px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: isMobile ? "flex-start" : "center", textAlign: isMobile ? "left" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Para onde você quer ir?</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 600, margin: 0 }}>Escolha um ou mais continentes — depois você pode refinar por país de sua preferência.</p>
        </div>
        {isMobile && <MobileProgress step={2 - stepOffset} total={WIZARD_TOTAL - stepOffset} />}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 16, justifyContent: "center", width: "100%" }}>
          {[{ id: "sa", label: "América do Sul" }, { id: "eu", label: "Europa" }].map((c) => {
            const active = continents.includes(c.id);
            return (
              <div key={c.id} onClick={() => toggleContinent(c.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: isMobile ? "100%" : 180, padding: "16px 20px", borderRadius: 8, background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, cursor: "pointer" }}>
                <Globe size={20} color={active ? GREEN : TEXT} />
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: active ? 700 : 500, fontSize: 14, color: active ? GREEN : TEXT }}>{c.label}</span>
              </div>
            );
          })}
        </div>
        {availableCountries.length > 0 && (
          <>
            <div style={{ height: 1, background: BORDER, width: isMobile ? "100%" : 800 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
              <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: GREEN, textTransform: "uppercase", margin: 0 }}>Pressione para selecionar os países</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: isMobile ? "flex-start" : "center", width: isMobile ? "100%" : 900 }}>
                {availableCountries.map((c) => <Pill key={c} active={countries.includes(c)} onClick={() => toggleCountry(c)}>{c}</Pill>)}
              </div>
            </div>
          </>
        )}
        {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0, textAlign: "center" }}>{error}</p>}
      </div>
      <WizardBottomBar onBack={onBack} onNext={handleNext} mutedBack />
    </div>
  );
}

// Times por liga/país — usa os mesmos nomes de time que já têm escudo
// mapeado (TEAM_LOGO_IDS), pra garantir que os logos apareçam certinho.
const TEAMS_BY_LEAGUE = [
  { country: "Inglaterra", league: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", teams: ["Arsenal", "Chelsea", "Liverpool", "Manchester City"] },
  { country: "Espanha", league: "La Liga", flag: "🇪🇸", teams: ["Real Madrid", "Barcelona", "Atlético Madrid", "Sevilla"] },
  { country: "Itália", league: "Serie A", flag: "🇮🇹", teams: ["Inter", "Milan", "Napoli", "Roma", "Lazio"] },
  { country: "Alemanha", league: "Bundesliga", flag: "🇩🇪", teams: ["Bayern München", "Borussia Dortmund"] },
  { country: "França", league: "Ligue 1", flag: "🇫🇷", teams: ["PSG", "Marseille"] },
  { country: "Portugal", league: "Primeira Liga", flag: "🇵🇹", teams: ["Porto", "Benfica"] },
  { country: "Holanda", league: "Eredivisie", flag: "🇳🇱", teams: ["Ajax", "Feyenoord", "PSV"] },
  { country: "Turquia", league: "Süper Lig", flag: "🇹🇷", teams: ["Galatasaray", "Fenerbahçe"] },
  { country: "Argentina", league: "Liga Profesional", flag: "🇦🇷", teams: ["Boca Juniors", "River Plate"] },
  { country: "Brasil", league: "Brasileirão", flag: "🇧🇷", teams: ["Flamengo", "Fluminense", "Corinthians", "Palmeiras"] },
  { country: "Uruguai", league: "Primera División", flag: "🇺🇾", teams: ["Peñarol", "Nacional"] },
  { country: "Chile", league: "Primera División", flag: "🇨🇱", teams: ["Colo-Colo", "Universidad de Chile"] },
  { country: "Colômbia", league: "Primera A", flag: "🇨🇴", teams: ["Millonarios", "Santa Fe"] },
];

/* ============================================================
   3.5 TIMES FAVORITOS (node 225:9126) — novo passo, entre Destino e Datas
   ============================================================ */
function StepTimesFavoritos({ answers, setAnswers, onNext, onBack, onHome, stepOffset = 0 }) {
  const isMobile = useIsMobile();
  const favoriteTeams = answers.favoriteTeams || [];
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const toggleTeam = (team) =>
    setAnswers((a) => ({
      ...a,
      favoriteTeams: favoriteTeams.includes(team) ? favoriteTeams.filter((t) => t !== team) : [...favoriteTeams, team],
    }));

  // Autocomplete de verdade: busca times reais na API (não só os ~30 já
  // conhecidos), com debounce pra não gastar cota a cada tecla.
  useEffect(() => {
    if (search.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teams/suggest?q=${encodeURIComponent(search)}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const pickSuggestion = (name) => {
    toggleTeam(name);
    setSearch("");
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // A grade de times por liga fica sempre visível (times pré-conhecidos
  // dos países escolhidos no passo anterior) — a busca serve só pra
  // adicionar OUTROS times que não estão nessa lista fixa, sem esconder
  // a grade ou dar a impressão de que as escolhas anteriores sumiram.
  const selectedCountries = answers.countries || [];
  const groups = TEAMS_BY_LEAGUE.filter((g) => selectedCountries.length === 0 || selectedCountries.includes(g.country));

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <WizardTopBar step={3 - stepOffset} total={WIZARD_TOTAL - stepOffset} onExit={onBack} onLogoClick={onHome} />
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 32, alignItems: "center", padding: isMobile ? "24px 16px" : "40px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: "center", textAlign: "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Quais são seus times favoritos?</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 720, margin: 0 }}>Selecione os clubes que você quer acompanhar — montaremos roteiros personalizados para os jogos deles.</p>
        </div>
        {isMobile && <MobileProgress step={3 - stepOffset} total={WIZARD_TOTAL - stepOffset} />}

        <div style={{ position: "relative", width: isMobile ? "100%" : 600 }}>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 8 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Buscar qualquer time (ex: Fiorentina)..."
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT }}
            />
            <Icon name="search" size={18} color={MUTED} />
          </div>
          {showSuggestions && search.trim().length >= 3 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", zIndex: 20, overflow: "hidden" }}>
              {loadingSuggestions && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0, padding: "12px 16px" }}>Buscando...</p>
              )}
              {!loadingSuggestions && suggestions.length === 0 && (
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0, padding: "12px 16px" }}>Nenhum time encontrado com esse nome.</p>
              )}
              {!loadingSuggestions && suggestions.map((s) => (
                <div key={s.name} onMouseDown={() => pickSuggestion(s.name)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                  <TeamBadge name={s.name} url={s.logo} size={24} />
                  <div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{s.name}</p>
                    {s.country && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{s.country}</p>}
                  </div>
                  {favoriteTeams.includes(s.name) && <Check size={16} color={GREEN} style={{ marginLeft: "auto" }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {favoriteTeams.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", width: isMobile ? "100%" : 900 }}>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: GREEN, textTransform: "uppercase", margin: 0, width: "100%", textAlign: isMobile ? "left" : "center" }}>Times selecionados ({favoriteTeams.length})</p>
            {favoriteTeams.map((team) => (
              <div key={team} onClick={() => toggleTeam(team)} style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 999, padding: "6px 12px", display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>{team}</p>
                <X size={12} color={GREEN} />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 40, width: isMobile ? "100%" : 900 }}>
          {groups.map((g) => (
            <div key={g.league} style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>{g.flag}</span>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{g.league}</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>({g.country})</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
                {g.teams.map((team) => {
                  const active = favoriteTeams.includes(team);
                  return (
                    <div key={team} onClick={() => toggleTeam(team)} style={{ background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "16px 20px", borderRadius: 8, cursor: "pointer" }}>
                      <TeamBadge name={team} size={24} />
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: active ? 700 : 500, fontSize: 14, color: active ? GREEN : TEXT, margin: 0, flex: 1 }}>{team}</p>
                      {active && <Check size={16} color={GREEN} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <WizardBottomBar onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ============================================================
   4. DATAS (node 95:546)
   ============================================================ */
function StepDatas({ answers, setAnswers, onNext, onBack, onHome, stepOffset = 0 }) {
  const isMobile = useIsMobile();
  const flexLevel = answers.flexLevel || "fixed";
  const FLEX_OPTS = [{ id: "fixed", label: "Datas fixas" }, { id: "some", label: "Posso variar alguns dias" }, { id: "flex", label: "Bastante flexibilidade" }];
  const [error, setError] = useState(null);

  const handleNext = () => {
    if (!answers.dateStart || !answers.dateEnd) {
      setError("Escolha a data de ida e a data de volta antes de continuar.");
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <WizardTopBar step={4 - stepOffset} total={WIZARD_TOTAL - stepOffset} onExit={onBack} onLogoClick={onHome} />
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 56, alignItems: isMobile ? "flex-start" : "center", padding: isMobile ? "24px 16px" : "40px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: isMobile ? "flex-start" : "center", textAlign: isMobile ? "left" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Quando você quer viajar?</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 600, margin: 0 }}>Escolha a data de ida, a data de volta e diga o quanto pode flexibilizar</p>
        </div>
        {isMobile && <MobileProgress step={4 - stepOffset} total={WIZARD_TOTAL - stepOffset} />}
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Data de Ida e Data de Volta</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, width: isMobile ? "100%" : 800 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Data de Ida</p>
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: isMobile ? "14px 16px" : "16px 24px", borderRadius: 8 }}>
                <Calendar size={20} color={TEXT} />
                <input
                  type="date"
                  value={answers.dateStart || ""}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setAnswers((a) => ({
                      ...a,
                      dateStart: newStart,
                      dateEnd: a.dateEnd && a.dateEnd < newStart ? "" : a.dateEnd,
                    }));
                  }}
                  style={{ flex: 1, border: "none", outline: "none", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, background: "transparent" }}
                />
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Data de Volta</p>
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: isMobile ? "14px 16px" : "16px 24px", borderRadius: 8 }}>
                <Calendar size={20} color={TEXT} />
                <input
                  type="date"
                  value={answers.dateEnd || ""}
                  min={answers.dateStart || new Date().toISOString().split("T")[0]}
                  onChange={(e) => setAnswers((a) => ({ ...a, dateEnd: e.target.value }))}
                  style={{ flex: 1, border: "none", outline: "none", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, background: "transparent" }}
                />
              </div>
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: BORDER, width: isMobile ? "100%" : 800 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Flexibilidade</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: isMobile ? 8 : 12, justifyContent: "center", width: isMobile ? "100%" : 800 }}>
            {FLEX_OPTS.map((o) => {
              const active = flexLevel === o.id;
              return (
                <div key={o.id} onClick={() => setAnswers((a) => ({ ...a, flexLevel: o.id }))} style={{ background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, padding: isMobile ? "14px 16px" : "16px 24px", borderRadius: 8, cursor: "pointer", width: isMobile ? "100%" : "auto" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 14 : 16, color: active ? GREEN : TEXT, margin: 0 }}>{o.label}</p>
                </div>
              );
            })}
          </div>
        </div>
        {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0, textAlign: isMobile ? "left" : "center" }}>{error}</p>}
      </div>
      <WizardBottomBar onBack={onBack} onNext={handleNext} />
    </div>
  );
}

/* ============================================================
   5. PESSOAS E ORÇAMENTO (node 95:606)
   ============================================================ */
function Counter({ label, value, onChange }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>{label}</p>
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderRadius: 8 }}>
        <div onClick={() => onChange(Math.max(0, value - 1))} style={{ background: BG_ALT, border: `1px solid ${BORDER}`, width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>−</p>
        </div>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{value}</p>
        <div onClick={() => onChange(value + 1)} style={{ background: BG_ALT, border: `1px solid ${BORDER}`, width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>+</p>
        </div>
      </div>
    </div>
  );
}

function StepPessoasOrcamento({ answers, setAnswers, onNext, onBack, onHome, stepOffset = 0 }) {
  const isMobile = useIsMobile();
  const adults = answers.adults ?? 2;
  const kids = answers.kids ?? 0;
  const budget = answers.budget;
  const budgetOpts = ["R$ 5.000", "R$ 10.000", "R$ 20.000", "R$ 30.000+"];
  const [error, setError] = useState(null);

  const handleNext = () => {
    if (!answers.budget && !answers.budgetCustom) {
      setError("Escolha um orçamento (ou digite um valor) antes de continuar.");
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <WizardTopBar step={5 - stepOffset} total={WIZARD_TOTAL - stepOffset} onExit={onBack} onLogoClick={onHome} />
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48, alignItems: isMobile ? "flex-start" : "center", padding: isMobile ? "24px 16px" : "40px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: isMobile ? "flex-start" : "center", textAlign: isMobile ? "left" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Quem vai e qual o orçamento total da viagem?</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 600, margin: 0 }}>Informe o número de viajantes e o orçamento total estimado para a viagem</p>
        </div>
        {isMobile && <MobileProgress step={5 - stepOffset} total={WIZARD_TOTAL - stepOffset} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: isMobile ? "100%" : 800 }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Viajantes</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 24 }}>
            <Counter label="Adultos" value={adults} onChange={(v) => setAnswers((a) => ({ ...a, adults: v }))} />
            <Counter label="Crianças" value={kids} onChange={(v) => setAnswers((a) => ({ ...a, kids: v }))} />
          </div>
        </div>
        <div style={{ height: 1, background: BORDER, width: isMobile ? "100%" : 800 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Orçamento total da viagem</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: isMobile ? "flex-start" : "center", width: isMobile ? "100%" : 800 }}>
            {budgetOpts.map((o) => (
              <div key={o} onClick={() => setAnswers((a) => ({ ...a, budget: o, budgetCustom: "" }))} style={{ background: "#fff", border: `1px solid ${budget === o ? GREEN : BORDER}`, padding: "12px 16px", borderRadius: 999, cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: budget === o ? GREEN : TEXT, margin: 0 }}>{o}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: isMobile ? "100%" : 800 }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Outro valor total</p>
            <div style={{ background: "#fff", border: `1.5px solid ${BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "12px 16px", borderRadius: 8 }}>
              <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: TEXT }}>R$</span>
              <input
                value={answers.budgetCustom || ""}
                onChange={(e) => setAnswers((a) => ({ ...a, budgetCustom: e.target.value, budget: undefined }))}
                placeholder="Digite o orçamento total..."
                style={{ flex: 1, border: "none", outline: "none", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: TEXT }}
              />
            </div>
          </div>
        </div>
        {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0, textAlign: isMobile ? "left" : "center" }}>{error}</p>}
      </div>
      <WizardBottomBar onBack={onBack} onNext={handleNext} mutedBack />
    </div>
  );
}

/* ============================================================
   6. PREFERÊNCIAS (node 95:681)
   ============================================================ */
function StepPreferencias({ answers, setAnswers, onNext, onBack, onHome, stepOffset = 0 }) {
  const isMobile = useIsMobile();
  const priority = answers.priority || "classics";
  const pace = answers.pace || "spaced";
  const PRIORITIES = [["maxgames", "Máximo de jogos"], ["stadiums", "Mais estádios"], ["classics", "Clássicos prioritários"], ["international", "Competições internacionais"]];
  const PACES = [["compact", "Mais compacto"], ["balanced", "Equilibrado"], ["spaced", "Mais espaçado"], ["relaxed", "Mais relaxado"]];

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <WizardTopBar step={6 - stepOffset} total={WIZARD_TOTAL - stepOffset} onExit={onBack} onLogoClick={onHome} />
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48, alignItems: isMobile ? "flex-start" : "center", padding: isMobile ? "24px 16px" : "40px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, alignItems: isMobile ? "flex-start" : "center", textAlign: isMobile ? "left" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 36, color: TEXT, margin: 0 }}>Como quer cruzar as partidas?</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 16, color: BODY, width: isMobile ? "100%" : 600, margin: 0 }}>Último passo - nos conte suas prioridades para cruzar partidas possíveis nos países e datas selecionados</p>
        </div>
        {isMobile && <MobileProgress step={6 - stepOffset} total={WIZARD_TOTAL - stepOffset} />}
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Prioridade do roteiro</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: isMobile ? 8 : 12, justifyContent: isMobile ? "flex-start" : "center", width: isMobile ? "100%" : 800 }}>
            {PRIORITIES.map(([id, label]) => {
              const active = priority === id;
              return (
                <div key={id} onClick={() => setAnswers((a) => ({ ...a, priority: id }))} style={{ background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, display: "flex", gap: 8, alignItems: "center", justifyContent: isMobile ? "space-between" : "flex-start", padding: 16, borderRadius: 8, cursor: "pointer", width: isMobile ? "100%" : "auto" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: active ? GREEN : TEXT, margin: 0 }}>{label}</p>
                  {active && <Check size={12} color={GREEN} />}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, alignItems: isMobile ? "flex-start" : "center", width: "100%" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 11 : 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Ritmo do roteiro</p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 12, width: isMobile ? "100%" : 800 }}>
            {PACES.map(([id, label]) => {
              const active = pace === id;
              return (
                <div key={id} onClick={() => setAnswers((a) => ({ ...a, pace: id }))} style={{ flex: isMobile ? "none" : 1, background: active ? GREEN_BG : "#fff", border: `1.5px solid ${active ? GREEN : BORDER}`, display: "flex", flexDirection: isMobile ? "row" : "column", gap: 8, alignItems: "center", justifyContent: isMobile ? "space-between" : "center", height: isMobile ? "auto" : 72, padding: isMobile ? 14 : 0, borderRadius: isMobile ? 8 : 12, cursor: "pointer" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: isMobile ? "flex-start" : "center" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: active ? GREEN : TEXT, margin: 0 }}>{label}</p>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: active ? GREEN : BODY, margin: 0 }}>({paceRangeLabel(id)})</p>
                  </div>
                  {active && <Check size={12} color={GREEN} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <WizardBottomBar onBack={onBack} onNext={onNext} nextLabel="Cruzar partidas →" mutedBack />
    </div>
  );
}

/* ============================================================
   ROTEIRO — adapta o plano REAL (lib/tripPlanner.js, montado por
   /api/trip/plan com jogos de verdade) ao formato que as telas usam.
   Nada aqui inventa jogo, preço ou nota: tudo vem do plano.
   ============================================================ */
const EMPTY_TRIP = { countries: [], games: [], cities: [], stadiums: [], days: 0, itinerary: [], notes: [], stats: null };

// "2026-10-07" -> Date em horário local (evita o dia voltar 1 por causa do fuso)
function parseISODate(s) {
  if (typeof s !== "string") return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function planToTrip(plan, fallbackCountries) {
  if (!plan) return EMPTY_TRIP;
  const games = (plan.selected || []).map((g) => ({
    id: g.id,
    home: g.home?.name || "",
    away: g.away?.name || "",
    homeLogo: g.home?.logo || null,
    awayLogo: g.away?.logo || null,
    city: g.venue?.city || "",
    stadium: g.venue?.name || g.venue?.city || "",
    country: g.country,
    date: parseISODate(g.matchDate),
    competition: g.competition?.name || "",
    // clássico (nome da rivalidade) quando existe; senão a competição
    tag: g.rivalry || g.competition?.name || "Jogo",
    rivalry: g.rivalry || null,
    favorite: !!g.favorite,
    approxLocation: !!g.approxLocation,
    insideDates: g.insideDates !== false,
  }));
  const countries = plan.countries?.length ? plan.countries : fallbackCountries || [];
  return {
    countries,
    games,
    cities: plan.cities || [],
    stadiums: plan.stadiums || [],
    days: plan.stats?.days || 0,
    itinerary: plan.itinerary || [],
    notes: plan.notes || [],
    stats: plan.stats || null,
  };
}

// A "foto" que vai pro banco: sem a lista completa de jogos possíveis (pesada,
// e as telas só usam o roteiro escolhido, o dia a dia e os avisos).
function slimPlan(plan) {
  if (!plan) return null;
  const { possible, ...rest } = plan;
  return rest;
}

// Pede ao servidor o roteiro com jogos reais pras respostas do questionário.
async function fetchPlan(answers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70000);
  try {
    const res = await fetch("/api/trip/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        countries: answers.countries,
        dateStart: answers.dateStart,
        dateEnd: answers.dateEnd,
        flexLevel: answers.flexLevel,
        favoriteTeams: answers.favoriteTeams || [],
        priority: answers.priority,
        pace: answers.pace,
        adults: answers.adults,
        kids: answers.kids,
        budget: answers.budget,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.plan) throw new Error(json?.message || "Não foi possível montar o roteiro agora.");
    return json.plan;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("A busca de jogos demorou demais. Tente de novo em instantes.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Avisos do plano (sem jogo nas datas, time favorito que não joga, local provável...)
// + estados de carregando/erro. A plataforma diz o que fez e o que NÃO conseguiu.
function PlanFeedback({ loading, error, notes, empty, onRetry }) {
  if (loading) {
    return <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Montando seu roteiro com os jogos reais...</p>;
  }
  if (error) {
    return (
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#b91c1c", margin: 0 }}>{error}</p>
        {onRetry && <Button variant="outline" small onClick={onRetry}>Tentar de novo</Button>}
      </div>
    );
  }
  const list = (notes || []).filter((n) => n && n.message);
  if (list.length === 0 && !empty) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map((n, i) => (
        <div key={i} style={{ background: GOLD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, lineHeight: 1.4, color: BODY, margin: 0 }}>{n.message}</p>
        </div>
      ))}
      {empty && list.length === 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Ainda não há jogos para mostrar neste roteiro.</p>}
    </div>
  );
}

/* ============================================================
   7. LOADING (node 95:746)
   ============================================================ */
function LoadingScreen({ onWork, onDone }) {
  const isMobile = useIsMobile();
  const [activeIdx, setActiveIdx] = useState(0);
  const lines = ["Cruzando calendários por país e data...", "Listando partidas possíveis...", "Organizando sequência de cidades...", "Preparando o roteiro..."];

  // O trabalho de verdade (buscar os jogos reais e salvar o roteiro) começa já,
  // em paralelo com a animação. O ref garante que rode UMA vez só (o modo
  // estrito do React monta os efeitos duas vezes em desenvolvimento).
  const workRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!workRef.current) workRef.current = Promise.resolve().then(() => (onWork ? onWork() : null)).catch((e) => { console.error(e); return null; });
      // Mostra cada etapa por um tempinho, uma de cada vez, e só avança
      // pra tela seguinte depois que a última etapa apareceu E o trabalho terminou.
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return;
        setActiveIdx(i);
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      const next = await workRef.current;
      if (!cancelled) onDone(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "0 16px" : 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 32 : 48, alignItems: "center", width: "100%" }}>
        <div style={{ width: isMobile ? 80 : 100, height: isMobile ? 80 : 100, borderRadius: "50%", border: `3px solid ${BORDER}`, borderTopColor: GREEN, animation: "spin 1.1s linear infinite" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 16, alignItems: "center", textAlign: "center" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 22 : 28, color: TEXT, margin: 0 }}>Construindo sua jornada perfeita...</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, color: GREEN, margin: 0 }}>{`"${lines[activeIdx]}"`}</p>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? 18 : 24, width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 12 }}>
          {lines.map((line, i) => (
            <div key={line} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {i < activeIdx ? <Check size={14} color={GREEN} /> : <div style={{ width: 6, height: 6, borderRadius: "50%", background: i === activeIdx ? GOLD_BORDER : BORDER, flexShrink: 0 }} />}
              <span style={{ fontFamily: FONT_MONO, fontSize: isMobile ? 12 : 13, color: i < activeIdx ? MUTED : i === activeIdx ? TEXT : MUTED, fontWeight: i === activeIdx ? 700 : 400 }}>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   8. RESULTADO BLOQUEADO (node 95:769)
   ============================================================ */
// Formata uma data como "18 MAR 2025" — igual ao Figma, sem o "de" que o
// toLocaleDateString("pt-BR") normalmente adiciona.
const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
function formatDateBadge(date) {
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, "0")} ${MESES_ABREV[date.getMonth()]} ${date.getFullYear()}`;
}

/* ============================================================
   ROTEIRO — opções A / B / C + consultoria na lateral
   (design do Figma: tela de resultado e detalhe do roteiro)
   ============================================================ */
const OPTION_TONES = {
  green: { bg: GREEN },
  navy: { bg: "#1E3A5F" },
  slate: { bg: "#334155" },
};

const NAVY_PILL = { background: "#1E3A5F", borderRadius: 4, padding: "3px 8px", display: "inline-flex" };

function LeaguePill({ children }) {
  return (
    <span style={{ ...NAVY_PILL, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: "#fff", whiteSpace: "nowrap" }}>{children}</span>
  );
}

/** Um dos cartões A / B / C com o dia a dia e o botão de escolher. */
function OptionCard({ opt, chosen, onChoose, isMobile }) {
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
function ConsultoriaCard({ chosenOpt, needChoice, onHire, onNeedChoice, isMobile }) {
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
function restrictionBullets(trip, options) {
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
  for (const n of notes) {
    if (bullets.length >= 5) break;
    if (["flex_used", "approx_location", "unlocated", "cap", "favorite_without_games"].includes(n.type) && n.message) bullets.push(n.message);
  }
  return bullets;
}

/** Tela do roteiro: usada logo depois do questionário (Resultado) e ao abrir um roteiro salvo (Detalhe). */
function RoteiroView({ trip, options, chosenOption, onChooseOption, planLoading, planError, onRetryPlan, onHireConsultoria, onNavigate, onLogout, onBack }) {
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
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 16 : 18, color: TEXT, margin: 0 }}>{f.home}</p>
                        </div>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 13 : 14, color: MUTED, margin: 0 }}>VS</p>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                          <TeamBadge name={f.away} url={f.awayLogo} size={logoSize} resolve />
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 16 : 18, color: TEXT, margin: 0 }}>{f.away}</p>
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
function ResultadoRoteiro({ trip, options, chosenOption, onChooseOption, planLoading, planError, onRetryPlan, onHireConsultoria, onNavigate, onLogout }) {
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
function RoteiroDetalhe({ trip, options, chosenOption, onChooseOption, planLoading, planError, onRetryPlan, onNavigate, onLogout, onBackToRoteiros, onHireConsultoria }) {
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

/* ============================================================
   9. ÁREA LOGADA — nav compartilhada + Meus Roteiros, Conquistas, Perfil
   ============================================================ */
function AvatarCircle({ url, name, size = 36, fontSize }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        src={url}
        alt={name || "avatar"}
        width={size}
        height={size}
        onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{ background: GREEN_BUTTON2, width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: fontSize || size * 0.4, color: "#fff", margin: 0 }}>{initials(name)}</p>
    </div>
  );
}

// Menu principal: 4 itens. "Meu calendário" e "Meu nível" são grupos que
// abrem a lista das telas deles. "Meu perfil" e "Minha assinatura" ficam no
// menu da conta (a foto, no canto).
const NAV_MAIN = [
  { label: "Meus roteiros", key: "roteiros" },
  { label: "Meus jogos", key: "jogos" },
  { label: "Meu calendário", children: [["Calendário", "calendario"], ["Buscar jogos", "buscar"]] },
  { label: "Meu nível", children: [["Nível", "nivel"], ["Minhas conquistas", "conquistas"], ["Ranking", "ranking"]] },
];

function AuthedNav({ active, userName, userAvatar, onNavigate, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null); // label do grupo com a lista aberta
  const closeTimer = useRef(null);
  const isMobile = useIsMobile();

  const groupActive = (it) => !!it.children && it.children.some(([, k]) => k === active);
  const itemActive = (it) => (it.children ? groupActive(it) : active === it.key);
  const go = (key) => {
    clearTimeout(closeTimer.current);
    setOpenGroup(null);
    setMenuOpen(false);
    onNavigate(key);
  };

  // Lembrete de confirmação de e-mail — não bloqueia nada, só avisa e
  // deixa reenviar o link de confirmação.
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [userEmailForBanner, setUserEmailForBanner] = useState("");
  const [resendStatus, setResendStatus] = useState("idle"); // idle | sending | sent
  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      setEmailConfirmed(!!data.user?.email_confirmed_at);
      setUserEmailForBanner(data.user?.email || "");
    })();
  }, []);
  const handleResendConfirmation = async () => {
    setResendStatus("sending");
    try {
      const supabase = supabaseBrowser();
      await supabase.auth.resend({ type: "signup", email: userEmailForBanner });
    } catch {
      // segue mesmo assim — não é crítico se falhar silenciosamente aqui
    } finally {
      setResendStatus("sent");
    }
  };

  const dropdownItem = (label, key) => (
    <div key={key} onClick={() => go(key)} style={{ padding: "10px 16px", cursor: "pointer", background: active === key ? GREEN_BG : "#fff" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: active === key ? 700 : 500, fontSize: 13, color: active === key ? GREEN : TEXT, margin: 0, whiteSpace: "nowrap" }}>{label}</p>
    </div>
  );

  return (
    <div>
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 16px" : "24px 48px", position: "relative" }}>
        <div style={{ cursor: "pointer" }} onClick={() => go("roteiros")}><Wordmark /></div>
        {!isMobile && (
          <div style={{ display: "flex", gap: 36, alignItems: "center", fontFamily: FONT_DISPLAY, fontSize: 14 }}>
            {NAV_MAIN.map((it) => {
              const on = itemActive(it);
              const color = on ? GREEN : MUTED;
              if (!it.children) {
                return (
                  <p key={it.key} onClick={() => go(it.key)} style={{ color, fontWeight: on ? 700 : 500, margin: 0, cursor: "pointer", whiteSpace: "nowrap" }}>{it.label}</p>
                );
              }
              return (
                <div
                  key={it.label}
                  style={{ position: "relative" }}
                  onMouseEnter={() => { clearTimeout(closeTimer.current); setMenuOpen(false); setOpenGroup(it.label); }}
                  onMouseLeave={() => { closeTimer.current = setTimeout(() => setOpenGroup((g) => (g === it.label ? null : g)), 150); }}
                >
                  <div onClick={() => go(it.children[0][1])} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <p style={{ color, fontWeight: on ? 700 : 500, margin: 0, whiteSpace: "nowrap" }}>{it.label}</p>
                    <Icon name="chevronDown" size={14} color={color} />
                  </div>
                  {openGroup === it.label && (
                    <div style={{ position: "absolute", top: "100%", left: -16, paddingTop: 14, zIndex: 20 }}>
                      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.1)", minWidth: 190, overflow: "hidden" }}>
                        {it.children.map(([label, key]) => dropdownItem(label, key))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ position: "relative" }}>
          <div onClick={() => { setOpenGroup(null); setMenuOpen((v) => !v); }} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: "8px 12px 8px 8px", borderRadius: 999, cursor: "pointer" }}>
            <AvatarCircle url={userAvatar} name={userName} size={isMobile ? 28 : 36} fontSize={isMobile ? 12 : 14} />
            {!isMobile && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{userName || "Minha conta"}</p>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, margin: 0 }}>Área do usuário</p>
              </div>
            )}
            {isMobile && <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: TEXT, margin: 0 }}>{(userName || "Conta").split(" ")[0]}</p>}
            <Icon name="chevronDown" size={16} color={MUTED} />
          </div>
          {menuOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.1)", width: 200, overflow: "hidden", zIndex: 20 }}>
              {[["Meu perfil", "perfil"], ["Minha assinatura", "assinatura"]].map(([label, key]) => (
                <div key={key} onClick={() => go(key)} style={{ padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: active === key ? GREEN : TEXT, fontWeight: active === key ? 700 : 500, margin: 0 }}>{label}</p>
                </div>
              ))}
              <div onClick={() => { setMenuOpen(false); onLogout(); }} style={{ padding: "12px 16px", cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#dc2626", fontWeight: 700, margin: 0 }}>Sair</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {!emailConfirmed && (
        <div style={{ background: GOLD_BG, borderBottom: `1px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "10px 16px", flexWrap: "wrap" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: GOLD, margin: 0, textAlign: "center" }}>Confirme seu e-mail ({userEmailForBanner}) pra garantir o acesso à sua conta.</p>
          <p onClick={resendStatus === "sending" ? undefined : handleResendConfirmation} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GOLD, textDecoration: "underline", margin: 0, cursor: resendStatus === "sending" ? "default" : "pointer" }}>
            {resendStatus === "sent" ? "E-mail reenviado ✓" : resendStatus === "sending" ? "Enviando..." : "Reenviar e-mail"}
          </p>
        </div>
      )}
      {isMobile && (
        <div>
          <div style={{ background: "#fff", borderBottom: openGroup ? "none" : `1px solid ${BORDER}`, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", alignItems: "stretch", gap: 4, padding: "6px 8px" }}>
            {NAV_MAIN.map((it) => {
              const on = itemActive(it);
              const open = openGroup === it.label;
              const color = on || open ? GREEN : "#63738c";
              return (
                <div
                  key={it.label}
                  onClick={() => (it.children ? setOpenGroup(open ? null : it.label) : go(it.key))}
                  style={{ background: on || open ? GREEN_BG : "transparent", padding: "8px 4px", borderRadius: 6, cursor: "pointer", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, textAlign: "center" }}
                >
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: on ? 700 : 500, fontSize: 12, lineHeight: 1.2, color, margin: 0 }}>{it.label}</p>
                  {it.children && <Icon name="chevronDown" size={12} color={color} style={{ transform: open ? "rotate(180deg)" : "none" }} />}
                </div>
              );
            })}
          </div>
          {openGroup && (
            <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "2px 8px 8px", display: "flex", flexDirection: "column" }}>
              {NAV_MAIN.find((it) => it.label === openGroup).children.map(([label, key]) => (
                <div key={key} onClick={() => go(key)} style={{ padding: "10px 12px", borderRadius: 6, cursor: "pointer", background: active === key ? GREEN_BG : "transparent" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: active === key ? 700 : 500, fontSize: 13, color: active === key ? GREEN : TEXT, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuthedFooter() {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState(null);

  const handleSubscribe = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Digite um e-mail válido.");
      return;
    }
    setStatus("loading");
    const supabase = supabaseBrowser();
    const { error: insertError } = await supabase.from("newsletter_subscribers").insert({ email });
    if (insertError) {
      // Código 23505 = e-mail duplicado (já inscrito) — trata como sucesso,
      // não faz sentido mostrar erro pra quem já está na lista.
      if (insertError.code === "23505") {
        setStatus("success");
        return;
      }
      setError("Não foi possível concluir a inscrição. Tente novamente.");
      setStatus("idle");
      return;
    }
    setStatus("success");
  };

  return (
    <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, padding: isMobile ? "40px 16px 24px" : "80px 80px 40px", display: "flex", flexDirection: "column", gap: isMobile ? 32 : 64 }}>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 32 : 0, alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: isMobile ? "100%" : 360 }}>
          <Wordmark />
          <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: BODY, margin: 0 }}>Somos uma plataforma pra montar roteiros de futebol e registrar seus jogos e estádios mundo afora. Ah, e se precisar, te ajudamos com consultoria pra voos, ingressos e hospedagem.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: isMobile ? "100%" : 300 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, textTransform: "uppercase", margin: 0 }}>Fique por dentro</p>
          {status === "success" ? (
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: GREEN, margin: 0 }}>Prontinho! Você vai receber nossos alertas por e-mail.</p>
          ) : (
            <>
              <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: BODY, margin: 0 }}>Receba alertas de pacotes especiais para derbies e finais europeias.</p>
              <div style={{ display: "flex", gap: 8, width: "100%" }}>
                <div style={{ background: BG_ALT, border: `1px solid ${BORDER}`, borderRadius: 6, flex: 1, height: 44, display: "flex", alignItems: "center", padding: 12 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
                    placeholder="Seu melhor e-mail"
                    style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 13, color: TEXT }}
                  />
                </div>
                <div onClick={status === "loading" ? undefined : handleSubscribe} style={{ background: GREEN_BUTTON, opacity: status === "loading" ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 24px", borderRadius: 8, cursor: status === "loading" ? "default" : "pointer", flexShrink: 0 }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>OK</p>
                </div>
              </div>
              {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>{error}</p>}
            </>
          )}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 24, display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 0, justifyContent: "space-between" }}>
        <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTED, margin: 0 }}>© 2026 tripsz. Todos os direitos reservados.</p>
        <div style={{ display: "flex", gap: 24 }}>
          <a href="/privacidade" style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, textDecoration: "none" }}>Privacidade</a>
          <a href="/termos" style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, textDecoration: "none" }}>Termos</a>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Contato</p>
        </div>
      </div>
    </div>
  );
}

/* --- Meus Roteiros: lista de verdade, lida do Supabase --- */
function MeusRoteiros({ onNavigate, onLogout, onOpenTrip, onEditTrip, onCreateNew }) {
  const isMobile = useIsMobile();
  const [trips, setTrips] = useState(null); // null = carregando
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState(null);

  const loadTrips = async () => {
    const supabase = supabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    setUserName(userData.user?.user_metadata?.name || userData.user?.email || "");
    setUserAvatar(userData.user?.user_metadata?.avatar_url || null);

    // RLS já garante que só voltam as viagens do próprio usuário — não
    // precisa (nem pode) filtrar por user_id manualmente aqui.
    const { data, error: fetchError } = await supabase
      .from("trip_answers")
      .select("*, orders(status, paid_at)")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setTrips([]);
      return;
    }
    setTrips(data || []);
  };

  useEffect(() => {
    loadTrips();
  }, []);

  // O roteiro em si nunca fica bloqueado por pagamento — o status aqui
  // reflete só o andamento da viagem. Pedidos em `orders` agora são só
  // consultorias humanas opcionais, então viram um indicador à parte
  // (hasConsultoria), não um portão de acesso.
  const deriveStatus = (row) => {
    if (row.date_end && new Date(row.date_end) < new Date()) return "Concluído";
    if (row.date_start) return "Ativo";
    return "Rascunho";
  };
  const hasConsultoria = (row) => row.orders?.some((o) => o.status === "paid" && o.item_type === "consultoria");

  const rowToAnswers = (row) => ({
    tripAnswersId: row.id,
    countries: row.countries || [],
    dateStart: row.date_start,
    dateEnd: row.date_end,
    flexLevel: row.flex_level,
    adults: row.adults,
    kids: row.kids,
    budget: row.budget,
    priority: row.priority,
    pace: row.pace,
    favoriteTeams: row.favorite_teams || [],
  });

  const handleDelete = async (row) => {
    if (!window.confirm(`Excluir o roteiro de ${row.countries?.join(" & ") || "viagem"}? Essa ação não pode ser desfeita.`)) return;
    const supabase = supabaseBrowser();
    const { error: delError } = await supabase.from("trip_answers").delete().eq("id", row.id);
    if (delError) {
      alert("Não foi possível excluir: " + delError.message);
      return;
    }
    setTrips((t) => t.filter((r) => r.id !== row.id));
  };

  const filtered = (trips || []).filter((row) => {
    const status = deriveStatus(row);
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (search) {
      const haystack = (row.countries || []).join(" ").toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const px = isMobile ? "16px" : "80px";

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="roteiros" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24, padding: isMobile ? `32px ${px}` : `80px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <Badge>Planejamento Ativo</Badge>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 56, lineHeight: 1.05, color: TEXT, margin: 0, position: "relative" }}>Biblioteca de Roteiros</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 22, lineHeight: 1.5, color: BODY, margin: 0, position: "relative", maxWidth: 700 }}>Acompanhe, duplique ou crie variações de trajetos para assistir aos melhores espetáculos de arquibancada do mundo.</p>
        <div style={{ position: "relative" }}>
          <Button onClick={onCreateNew}>Criar Novo Roteiro</Button>
        </div>
      </div>

      <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: isMobile ? `20px ${px}` : `40px ${px}` }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, width: "100%" }}>
          <div style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 8 }}>
            <Icon name="search" size={18} color={MUTED} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar roteiro por destino..."
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14, color: TEXT }}
          >
            <option value="all">Status: Todos</option>
            <option value="Ativo">Ativo</option>
            <option value="Concluído">Concluído</option>
            <option value="Rascunho">Rascunho</option>
          </select>
        </div>
      </div>

      <div style={{ background: BG_ALT, padding: isMobile ? `24px ${px}` : `48px ${px}`, display: "flex", flexDirection: "column", gap: 24 }}>
        {trips === null && <Loading text="Carregando seus roteiros..." />}
        {error && <p style={{ fontFamily: FONT_DISPLAY, color: "#dc2626" }}>Erro ao carregar: {error}</p>}
        {trips !== null && filtered.length === 0 && (
          <div style={{ background: "#fff", border: `1px dashed ${BORDER}`, borderRadius: 12, padding: 48, textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Nenhum roteiro por aqui ainda</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: BODY, margin: "8px 0 20px" }}>Preencha o questionário pra gerar seu primeiro roteiro de futebol.</p>
            <Button onClick={onCreateNew}>Criar Novo Roteiro</Button>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>
          {filtered.map((row) => {
            const status = deriveStatus(row);
            const preview = planToTrip(row.plan, row.countries);
            const days = row.date_start && row.date_end ? Math.max(1, Math.round((new Date(row.date_end) - new Date(row.date_start)) / 86400000)) : preview.days;
            const statusColor = status === "Ativo" ? GREEN : MUTED;
            return (
              <div key={row.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, margin: 0 }}>{(row.countries || []).join(" & ").toUpperCase() || "SEM PAÍS"} // {days} DIAS</p>
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>{new Date(row.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).toUpperCase()}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>{(row.countries || []).join(" & ") || "Roteiro sem destino"}</p>
                    <div style={{ background: statusColor === GREEN ? GREEN_BG : BG_ALT, padding: "4px 8px", borderRadius: 4 }}>
                      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: statusColor, margin: 0 }}>{status.toUpperCase()}</p>
                    </div>
                    {hasConsultoria(row) && (
                      <div style={{ background: GOLD_BG, padding: "4px 8px", borderRadius: 4 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: GOLD, margin: 0 }}>CONSULTORIA CONTRATADA</p>
                      </div>
                    )}
                  </div>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: BODY, margin: 0 }}>{row.plan ? `${preview.games.length} partida(s) no roteiro, sequência por ${preview.cities.join(", ") || "definir"}.` : "Abra o roteiro para ver as partidas."}</p>
                </div>
                {preview.games.length > 0 && (
                  <div style={{ background: BG_ALT, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: MUTED, margin: 0 }}>PARTIDAS SUGERIDAS</p>
                    {preview.games.slice(0, 2).map((g, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <TeamBadge name={g.home} url={g.homeLogo} size={18} />
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{g.home} × {g.away}</p>
                          <TeamBadge name={g.away} url={g.awayLogo} size={18} />
                        </div>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{g.stadium}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 16 }}>
                    <p onClick={() => onOpenTrip(rowToAnswers(row), row.plan, row.selected_option)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0, cursor: "pointer" }}>Abrir Roteiro</p>
                    <p onClick={() => onEditTrip(rowToAnswers(row))} style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14, color: MUTED, margin: 0, cursor: "pointer" }}>Editar</p>
                    <p onClick={() => handleDelete(row)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14, color: "#ef4444", margin: 0, cursor: "pointer" }}>Excluir</p>
                  </div>
                </div>
              </div>
            );
          })}
          {trips !== null && (
            <div onClick={onCreateNew} style={{ background: "#fff", border: `2px dashed ${BORDER}`, borderRadius: 12, display: "flex", flexDirection: "column", gap: 16, alignItems: "center", justifyContent: "center", padding: 32, cursor: "pointer", minHeight: 220 }}>
              <div style={{ background: GREEN_BG, width: 48, height: 48, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="arrowRight" size={20} color={GREEN} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Criar uma nova alternativa</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: "4px 0 0" }}>Gere um novo Football Passport com destinos diferentes.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}

/* --- Minhas Conquistas: Football Passport com estatísticas reais --- */
// Estádios icônicos reconhecidos pra badge "Colecionador de Templos" —
// lista curada, não exaustiva.
const ICONIC_STADIUMS = [
  "maracanã", "anfield", "san siro", "giuseppe meazza", "camp nou",
  "santiago bernabéu", "old trafford", "allianz arena", "signal iduna park",
  "estádio cívitas metropolitano", "wanda metropolitano", "emirates stadium",
];

// Pares de clássicos/derbies conhecidos, pra badge "Clássico" — em
// qualquer ordem (casa x fora ou fora x casa).
const KNOWN_DERBIES = [
  ["Flamengo", "Fluminense"], ["Corinthians", "Palmeiras"], ["Real Madrid", "Barcelona"],
  ["Inter", "Milan"], ["Boca Juniors", "River Plate"], ["Arsenal", "Tottenham"],
  ["Liverpool", "Everton"], ["Manchester City", "Manchester United"],
];

function isDerby(home, away) {
  return KNOWN_DERBIES.some(([a, b]) => (home === a && away === b) || (home === b && away === a));
}

const TIER_COLORS = { bronze: "#cd7f32", silver: "#c0c0c0", gold: "#ffd700" };

function computeBadgeCategories(ctx) {
  if (!ctx) return [];
  const { allGames: games, stadiumsSet, countriesSet, favoriteTeamsSet, manualCount, apiCount, userCreatedAt, hasPublicProfile } = ctx;
  const totalGames = games.length;

  const hasCompetition = (regex, countryFilter) =>
    games.some((g) => regex.test(g.competition || "") && (!countryFilter || g.country === countryFilter));

  const validDates = games.map((g) => new Date(g.date)).filter((d) => !isNaN(d));
  const firstGameDate = validDates.length ? new Date(Math.min(...validDates)) : null;

  const hasIconicStadium = games.some((g) => ICONIC_STADIUMS.some((s) => (g.stadium || "").toLowerCase().includes(s)));

  const euSet = new Set(COUNTRIES_BY_CONTINENT.eu || []);
  const saSet = new Set(COUNTRIES_BY_CONTINENT.sa || []);
  const hasEU = [...countriesSet].some((c) => euSet.has(c));
  const hasSA = [...countriesSet].some((c) => saSet.has(c));
  const hasDerby = games.some((g) => isDerby(g.home, g.away));

  const teamToLeague = {};
  TEAMS_BY_LEAGUE.forEach((g) => g.teams.forEach((t) => { teamToLeague[t] = g.league; }));
  const favoriteLeagues = new Set([...favoriteTeamsSet].map((t) => teamToLeague[t]).filter(Boolean));
  const hasFavoriteGame = games.some((g) => favoriteTeamsSet.has(g.home) || favoriteTeamsSet.has(g.away));

  // "Maratonista": jogos em 2+ países dentro de uma janela de 7 dias.
  const sorted = games.map((g) => ({ ...g, d: new Date(g.date) })).filter((g) => !isNaN(g.d)).sort((a, b) => a.d - b.d);
  let hasMarathon = false;
  for (let i = 0; i < sorted.length && !hasMarathon; i++) {
    const windowCountries = new Set();
    for (let j = i; j < sorted.length; j++) {
      if ((sorted[j].d - sorted[i].d) / 86400000 > 7) break;
      if (sorted[j].country) windowCountries.add(sorted[j].country);
    }
    if (windowCountries.size >= 2) hasMarathon = true;
  }

  const hasWinterEU = games.some((g) => {
    const d = new Date(g.date);
    const m = d.getMonth() + 1;
    return euSet.has(g.country) && (m === 12 || m === 1 || m === 2);
  });
  const hasNewYear = games.some((g) => {
    const d = new Date(g.date);
    return (d.getMonth() === 11 && d.getDate() === 31) || (d.getMonth() === 0 && d.getDate() === 1);
  });

  const isLegacy = !!(userCreatedAt && userCreatedAt < PASSPORT_LAUNCH_DATE);
  const b = (unlocked, detail) => ({ unlocked, detail: detail || null });

  // Seleção Nacional — o nome do time bate com o de uma seleção (times
  // de país, não de clube).
  const NATIONAL_TEAM_NAMES = new Set([
    "Brazil", "Argentina", "England", "Spain", "Italy", "Germany", "France",
    "Portugal", "Netherlands", "Turkey", "Uruguay", "Chile", "Colombia",
    "USA", "Mexico", "Japan", "South Korea", "Morocco", "Croatia", "Serbia",
    "Poland", "Belgium", "Switzerland", "Austria", "Denmark", "Sweden",
    "Norway", "Egypt", "Russia", "Greece", "Scotland", "Ukraine",
  ]);
  const hasNationalTeamGame = games.some((g) => NATIONAL_TEAM_NAMES.has(g.home) || NATIONAL_TEAM_NAMES.has(g.away));

  // Rival Histórico — foi a um clássico envolvendo um dos times favoritos.
  const hasFavoriteDerby = games.some((g) => (favoriteTeamsSet.has(g.home) || favoriteTeamsSet.has(g.away)) && isDerby(g.home, g.away));

  // Coração Dividido — times favoritos de 2+ ligas diferentes (cada liga
  // doméstica é de um país só, então isso é um bom indício de torcida
  // em mais de um país).
  const hasDividedHeart = favoriteLeagues.size >= 2;

  // Veterano de Conta — conta criada há mais de 1 ano.
  const isVeteranAccount = !!(userCreatedAt && (Date.now() - userCreatedAt.getTime()) > 365 * 86400000);

  // Verão Sul-Americano — jogo na América do Sul entre dezembro e
  // fevereiro (é verão lá, oposto do Inverno Europeu).
  const hasSummerSA = games.some((g) => {
    const d = new Date(g.date);
    const m = d.getMonth() + 1;
    return saSet.has(g.country) && (m === 12 || m === 1 || m === 2);
  });

  // Ano de Copa — jogo (de qualquer competição) durante uma janela real
  // de Copa do Mundo. 2022 foi em nov-dez (por causa do calor no Catar);
  // 2026 é o padrão jun-jul.
  const WORLD_CUP_WINDOWS = [
    { start: new Date("2022-11-20"), end: new Date("2022-12-18") },
    { start: new Date("2026-06-11"), end: new Date("2026-07-19") },
  ];
  const hasWorldCupYear = games.some((g) => {
    const d = new Date(g.date);
    return WORLD_CUP_WINDOWS.some((w) => d >= w.start && d <= w.end);
  });

  return [
    {
      title: "Estádios & Geografia",
      badges: [
        { id: "est5", label: "5 Estádios", ...b(stadiumsSet.size >= 5) },
        { id: "est15", label: "15 Estádios", ...b(stadiumsSet.size >= 15) },
        { id: "est25", label: "25 Estádios", ...b(stadiumsSet.size >= 25) },
        { id: "est50", label: "50 Estádios", ...b(stadiumsSet.size >= 50) },
        { id: "est100", label: "100 Estádios", ...b(stadiumsSet.size >= 100) },
        { id: "pais3", label: "3 Países", ...b(countriesSet.size >= 3) },
        { id: "pais5", label: "5 Países", ...b(countriesSet.size >= 5) },
        { id: "pais10", label: "10 Países", ...b(countriesSet.size >= 10) },
        { id: "continentes2", label: "2 Continentes", ...b(hasEU && hasSA) },
        // "5 Continentes" fica sempre bloqueada por enquanto — hoje o
        // app só cobre 13 países em 2 continentes (Europa e América do
        // Sul), então não tem como isso ser desbloqueado de verdade
        // ainda. Mantemos o card pra bater com o design, mas sem
        // fingir que é alcançável.
        { id: "continentes5", label: "5 Continentes", ...b(false) },
      ],
    },
    {
      title: "Competições",
      badges: [
        { id: "champions", label: "Champions League", ...b(games.some((g) => g.competition === "champions") || hasCompetition(/champions league/i)) },
        { id: "worldcup", label: "Copa do Mundo", ...b(hasMainTournament(games, "worldcup")) },
        { id: "premier", label: "Premier League", ...b(hasCompetition(/premier league/i)) },
        { id: "laliga", label: "La Liga", ...b(hasCompetition(/la liga/i)) },
        { id: "seriea", label: "Serie A", ...b(hasCompetition(/serie a/i, "Italy")) },
        { id: "bundesliga", label: "Bundesliga", ...b(hasCompetition(/bundesliga/i)) },
        { id: "ligue1", label: "Ligue 1", ...b(hasCompetition(/ligue 1/i)) },
        { id: "brasileirao", label: "Brasileirão", ...b(hasCompetition(/brasileir/i) || hasCompetition(/serie a/i, "Brazil")) },
        { id: "libertadores", label: "Libertadores", ...b(hasCompetition(/libertadores/i)) },
        { id: "mundialclubes", label: "Mundial de Clubes", ...b(hasCompetition(/club world cup|mundial de clubes/i)) },
        ...TOURNAMENTS.filter((t) => t.id !== "worldcup").map((t) => ({ id: t.id, label: t.label, ...b(hasMainTournament(games, t.id)) })),
        { id: "classico", label: "Clássico", ...b(hasDerby) },
      ],
    },
    {
      title: "Marcos de Jornada",
      badges: [
        { id: "primeiro", label: "Primeiro Jogo", ...b(totalGames >= 1, firstGameDate) },
        { id: "jogos5", label: "5 Jogos", ...b(totalGames >= 5) },
        { id: "jogos10", label: "10 Jogos", ...b(totalGames >= 10) },
        { id: "jogos25", label: "25 Jogos", ...b(totalGames >= 25) },
        { id: "jogos50", label: "50 Jogos", ...b(totalGames >= 50) },
        { id: "jogos100", label: "100 Jogos", ...b(totalGames >= 100) },
        { id: "jogos150", label: "150 Jogos", ...b(totalGames >= 150) },
        { id: "jogos200", label: "200 Jogos", ...b(totalGames >= 200) },
        { id: "jogos250", label: "250 Jogos", ...b(totalGames >= 250) },
        { id: "jogos500", label: "500 Jogos", ...b(totalGames >= 500) },
        { id: "maratonista", label: "Maratonista", ...b(hasMarathon) },
      ],
    },
    {
      title: "Times Favoritos",
      badges: [
        { id: "torcedorfiel", label: "Torcedor Fiel", ...b(hasFavoriteGame) },
        { id: "selecaonacional", label: "Seleção Nacional", ...b(hasNationalTeamGame) },
        { id: "multitorcida", label: "Multi-Torcida", ...b(favoriteLeagues.size >= 3) },
        { id: "rivalhistorico", label: "Rival Histórico", ...b(hasFavoriteDerby) },
        { id: "coracaodividido", label: "Coração Dividido", ...b(hasDividedHeart) },
      ],
    },
    {
      title: "Passport & Comunidade",
      badges: [
        { id: "fundador", label: "Membro Fundador", ...b(isLegacy, userCreatedAt) },
        { id: "detetive", label: "Detetive de Campo", ...b(manualCount >= 1) },
        { id: "perfilcompartilhado", label: "Perfil Compartilhado", ...b(!!hasPublicProfile) },
        { id: "assinante", label: "Assinante", ...b(!!ctx.isSubscriber) },
        { id: "verificado", label: "Verificado", ...b(apiCount >= 10) },
        { id: "veteranoconta", label: "Veterano de Conta", ...b(isVeteranAccount) },
      ],
    },
    {
      title: "Sazonais",
      badges: [
        { id: "invernoeuropeu", label: "Inverno Europeu", ...b(hasWinterEU) },
        { id: "reveillon", label: "Réveillon do Futebol", ...b(hasNewYear) },
        { id: "veraosulamericano", label: "Verão Sul-Americano", ...b(hasSummerSA) },
        { id: "anodecopa", label: "Ano de Copa", ...b(hasWorldCupYear) },
      ],
    },
  ];
}

function MinhasConquistas({ onNavigate, onLogout, onCreateNew }) {
  const isMobile = useIsMobile();
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [userId, setUserId] = useState("");
  const [stats, setStats] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [attendedGames, setAttendedGames] = useState([]);
  const [showAddGame, setShowAddGame] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [loadingShareLink, setLoadingShareLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGetShareLink = async () => {
    setLoadingShareLink(true);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const res = await authFetch("/api/profile/get-or-create-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userData.user?.id, name: userData.user?.user_metadata?.name }),
      });
      const data = await res.json();
      if (res.ok) setShareLink(`${window.location.origin}/u/${data.slug}`);
    } catch {
      // silencioso — não é uma ação crítica, a pessoa pode tentar de novo
    } finally {
      setLoadingShareLink(false);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const looksLikeChampions = (name) => /champions league/i.test(name || "");

  const loadData = async () => {
    const supabase = supabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setUserName(user?.user_metadata?.name || user?.email || "");
    setUserAvatar(user?.user_metadata?.avatar_url || null);
    setUserId(user?.id || "");

    const { data: rows } = await supabase.from("trip_answers").select("*, orders(status)");
    const trips = rows || [];

    // Só contam pra estatística os roteiros de fato pagos/desbloqueados —
    // um rascunho não gerado ainda não é uma "conquista".
    const unlocked = trips.filter((r) => r.orders?.some((o) => o.status === "paid"));
    const source = unlocked.length ? unlocked : trips; // fallback pra não ficar tudo zerado em conta nova

    // Assinante — precisa ser uma assinatura de verdade (paga), não
    // só acesso de graça por ser conta legada.
    const { data: activeSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("status", "active")
      .maybeSingle();
    const isSubscriber = !!activeSub;

    const { data: attendedRows } = await supabase
      .from("attended_games")
      .select("*")
      .order("match_date", { ascending: false });
    const attended = attendedRows || [];
    setAttendedGames(attended);

    // Só jogos REGISTRADOS de verdade contam pras conquistas — gerar um
    // roteiro sugerido é só uma sugestão de viagem, não uma confirmação
    // de que a pessoa foi ao jogo.
    const allGames = attended.map((g) => ({ date: new Date(g.match_date), stadium: g.stadium, city: g.city, country: g.country, competition: g.competition, home: g.home_team, away: g.away_team, source: g.source }));

    const stadiums = new Set(allGames.map((g) => g.stadium).filter(Boolean));
    const countries = new Set(allGames.map((g) => g.country).filter(Boolean));
    const competitions = new Set(allGames.map((g) => g.competition || "domestica"));
    const hasChampions = allGames.some((g) => looksLikeChampions(g.competition));

    // Times favoritos declarados de verdade em Meu Perfil — campo
    // estável, não muda a cada roteiro que a pessoa preenche.
    const favoriteTeams = new Set(user?.user_metadata?.favorite_teams || []);

    // Perfil Compartilhado — a pessoa já gerou o link do Football
    // Passport público (tabela public_profiles).
    const { data: publicProfileRow } = await supabase
      .from("public_profiles")
      .select("slug")
      .eq("user_id", user?.id)
      .maybeSingle();
    if (publicProfileRow?.slug) setShareLink(`${window.location.origin}/u/${publicProfileRow.slug}`);

    setStats({
      stadiums: stadiums.size,
      countries: countries.size,
      games: allGames.length,
      competitions: competitions.size,
      hasChampions,
      tripsCount: source.length,
    });

    setCtx({
      allGames,
      stadiumsSet: stadiums,
      countriesSet: countries,
      favoriteTeamsSet: favoriteTeams,
      hasPublicProfile: !!publicProfileRow,
      isSubscriber,
      manualCount: attended.filter((g) => g.source === "manual").length,
      apiCount: attended.filter((g) => g.source === "api").length,
      userCreatedAt: user?.created_at ? new Date(user.created_at) : null,
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteAttended = async (id) => {
    if (!window.confirm("Remover este jogo da sua lista de conquistas?")) return;
    const supabase = supabaseBrowser();
    await supabase.from("attended_games").delete().eq("id", id);
    loadData();
  };

  const px = isMobile ? "16px" : "80px";
  const level = stats && stats.countries >= 5 ? "VIP GROUNDHOPPER" : stats && stats.countries >= 1 ? "GROUNDHOPPER" : "NOVATO";

  const fmtDate = (d) => {
    if (!d) return null;
    const dd = new Date(d);
    if (isNaN(dd)) return null;
    return `${String(dd.getDate()).padStart(2, "0")} ${MESES_ABREV[dd.getMonth()].charAt(0) + MESES_ABREV[dd.getMonth()].slice(1).toLowerCase()} ${dd.getFullYear()}`;
  };

  const badgeCategories = computeBadgeCategories(ctx);

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="conquistas" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ position: "relative", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 64, alignItems: "center", flexWrap: "wrap", padding: isMobile ? `32px ${px}` : `80px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <div style={{ position: "relative", flex: isMobile ? 1 : "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <Badge>Documento Oficial do Torcedor</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 56, lineHeight: 1.05, color: TEXT, margin: 0 }}>Seu Football Passport</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 22, lineHeight: 1.5, color: BODY, margin: 0 }}>Toda atmosfera vivida, cada arquibancada tremendo e os templos do futebol mundial que você já conquistou. Colecione conquistas de suas viagens.</p>
          <div><Button onClick={onCreateNew}>Montar Outra Viagem</Button></div>
        </div>
        <div style={{ position: "relative", background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 16, padding: 32, width: isMobile ? "100%" : 420, maxWidth: "100%", flexShrink: 0, display: "flex", flexDirection: "column", gap: 24, boxShadow: "0px 12px 24px rgba(0,200,83,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>FOOTBALL PASSPORT</p>
            <Icon name="shieldCheck" size={24} color={GREEN} />
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ width: 80, height: 100, borderRadius: 8, border: `1px solid ${BORDER}`, background: GREEN_BUTTON2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
              {userAvatar ? (
                <img src={userAvatar} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: "#fff", margin: 0 }}>{initials(userName)}</p>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nome do Titular</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{userName || "—"}</p>
              </div>
              <div>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nível de Acesso</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>{level}</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>ID: #{userId ? userId.slice(0, 4).toUpperCase() : "----"}-MD</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>ATIVAÇÃO: {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: "0px 8px 12px rgba(15,23,42,0.07)", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 24, padding: isMobile ? 20 : "16px 24px", margin: isMobile ? `0 ${px}` : `0 80px` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: isMobile ? "none" : "0 0 320px" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Perfil público</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: BODY, margin: 0 }}>Reúna jogos, estádios, badges e conquistas em uma página compartilhável para amigos.</p>
        </div>
        <div style={{ background: BG, display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", flex: 1, minWidth: 0 }}>
          <Globe size={16} color={MUTED} style={{ flexShrink: 0 }} />
          <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTED, margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {shareLink ? shareLink.replace(/^https?:\/\//, "") : "Gere seu link abaixo para ver aqui"}
          </p>
          {shareLink && (
            <div onClick={handleCopyShareLink} style={{ cursor: "pointer", flexShrink: 0, display: "flex" }} title="Copiar link">
              <Clipboard size={16} color={copied ? GREEN : MUTED} />
            </div>
          )}
        </div>
        {!shareLink && (
          <div onClick={loadingShareLink ? undefined : handleGetShareLink} style={{ background: GREEN, padding: "10px 20px", borderRadius: 8, textAlign: "center", cursor: loadingShareLink ? "default" : "pointer", flexShrink: 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", margin: 0, whiteSpace: "nowrap" }}>{loadingShareLink ? "Gerando..." : "Gerar perfil público"}</p>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", padding: isMobile ? `24px ${px}` : `48px ${px}` }}>
        {[["stadiums", "Estádios Visitados"], ["countries", "Países Conquistados"], ["games", "Jogos Assistidos"], ["competitions", "Competições Diferentes"]].map(([key, label]) => (
          <div key={key} style={{ flex: isMobile ? "1 0 45%" : 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: isMobile ? 16 : 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 40, color: GREEN, margin: 0 }}>{stats ? stats[key] : "—"}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, textTransform: "uppercase", textAlign: "center", margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ background: BG_ALT, padding: isMobile ? `32px ${px}` : `80px ${px}`, display: "flex", flexDirection: "column", gap: 24 }}>
        <Badge gold>Galeria de Conquistas</Badge>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 22 : 32, color: TEXT, margin: 0 }}>Badges de Viagem</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {badgeCategories.map((cat) => (
            <div key={cat.title} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ background: GREEN, width: 4, height: 32, borderRadius: 2 }} />
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: TEXT, textTransform: "uppercase", margin: 0 }}>{cat.title}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 16 }}>
                {cat.badges.map((bdg) => {
                  const dateLabel = bdg.unlocked ? (fmtDate(bdg.detail) || "Desbloqueado") : "Bloqueado";
                  // Mesmo ícone que o Figma usa por categoria: Globe pra
                  // país/continente, estádio de verdade (ícone próprio)
                  // pros estádios, Trophy pra competição, Award pro resto.
                  const isStadiumBadge = cat.title === "Estádios & Geografia" && !/país|continente/i.test(bdg.label);
                  let BadgeIcon = Award;
                  if (cat.title === "Estádios & Geografia") {
                    BadgeIcon = Globe;
                  } else if (cat.title === "Competições") {
                    BadgeIcon = Trophy;
                  }
                  return (
                    <div key={bdg.id} style={{ background: "#fff", border: `1.5px solid ${bdg.unlocked ? GREEN : BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16, minHeight: 160, opacity: bdg.unlocked ? 1 : 0.6 }}>
                      <div style={{ background: bdg.unlocked ? GREEN_BG : BG_ALT, width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isStadiumBadge ? <Icon name="stadium" size={20} color={bdg.unlocked ? GREEN : MUTED} /> : <BadgeIcon size={20} color={bdg.unlocked ? GREEN : MUTED} />}
                      </div>
                      <div>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: bdg.unlocked ? TEXT : MUTED, margin: 0 }}>{bdg.label}</p>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: bdg.unlocked ? GREEN : MUTED, textTransform: "uppercase", margin: 0 }}>{dateLabel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}


/* --- Meus Jogos: histórico real dos jogos registrados, agrupado por temporada --- */
// Temporada de um jogo registrado: europeia (jul–jun, "2026/27") ou, pra
// Brasileirão, Libertadores, América do Sul, MLS etc., ano-calendário ("2026").
function seasonOfGame(g) {
  return gameSeason(g.match_date, { country: g.country, competition: g.competition });
}

/* --- Acesso ao Passport: Meu Nível, Minhas Conquistas e Registrar Jogo
   são de graça pra todo mundo. O que é pago (R$9,90/mês ou R$99,90/ano)
   é registrar mais de 20 jogos, e a importação em massa (Futbology).
   Usuários de antes do lançamento da assinatura ("legado") não têm
   nenhum desses limites. --- */
const PASSPORT_LAUNCH_DATE = new Date("2026-09-25T00:00:00Z");

// E-mails com acesso completo liberado manualmente, sem precisar de
// assinatura — configurado na Vercel (NEXT_PUBLIC_FREE_ACCESS_EMAILS,
// separados por vírgula). De propósito não mexe na tabela de
// assinaturas, pra não distorcer os números de receita/MRR no painel
// administrativo.
function isFreeAccessEmail(email) {
  const allowed = (process.env.NEXT_PUBLIC_FREE_ACCESS_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.toLowerCase());
}

// Limite de jogos pra quem não é assinante — Nível, Conquistas e
// Ranking já são de graça pra todo mundo; isso só limita QUANTOS jogos
// dá pra registrar sem assinar.
const FREE_GAMES_LIMIT = 20;

async function checkPassportAccess() {
  const supabase = supabaseBrowser();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return { hasAccess: false, isPaid: false, legacy: false, userId: null, userEmail: null, gamesCount: 0, gamesLimit: FREE_GAMES_LIMIT, canAddMoreGames: false };
  }

  let isPaid = false;
  let legacy = false;
  let freeAccess = false;
  let subscription = null;

  if (new Date(user.created_at) < PASSPORT_LAUNCH_DATE) {
    isPaid = true;
    legacy = true;
  } else if (isFreeAccessEmail(user.email)) {
    isPaid = true;
    freeAccess = true;
  } else {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) {
      isPaid = true;
      subscription = sub;
    }
  }

  const { count: gamesCount } = await supabase
    .from("attended_games")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  const gamesLimit = isPaid ? Infinity : FREE_GAMES_LIMIT;

  return {
    hasAccess: true, // o Passport em si (Nível/Conquistas/Ranking) agora é sempre de graça
    isPaid,
    legacy,
    freeAccess,
    subscription,
    userId: user.id,
    userEmail: user.email,
    gamesCount: gamesCount || 0,
    gamesLimit,
    canAddMoreGames: (gamesCount || 0) < gamesLimit,
  };
}

function PassportPaywall({ userId, userEmail, userName, userAvatar, onCreateNew }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);

  const handleSubscribe = async (plan) => {
    setError(null);
    setLoadingPlan(plan);
    try {
      const res = await authFetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: userEmail, plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível iniciar a assinatura.");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e.message);
      setLoadingPlan(null);
    }
  };

  const features = [
    [Clipboard, "Registro Ilimitado de Jogos", "Adicione todas as partidas que você já assistiu ou planeja assistir nos estádios europeus."],
    [Award, "Badges Exclusivas", "Ganhe insígnias virtuais personalizadas para cada clássico, liga ou país desbloqueado."],
    [BarChart2, "Estatísticas Completas", "Acompanhe gráficos ricos sobre sua jornada, estádios visitados e gols assistidos ao vivo."],
    [TrendingUp, "Ranking de Torcedores", "Compare seu passaporte com outros viajantes e dispute a liderança no ranking nacional."],
    [Star, "Níveis de Torcedor", "Suba do nível 'Torcedor de Sofá' até a lendária categoria 'Lenda da Arquibancada'."],
    [Share2, "Compartilhamento Social", "Gere cards personalizados perfeitos para postar no Instagram e mostrar seu progresso."],
  ];

  return (
    <div style={{ background: BG, width: "100%" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 64, alignItems: "center", flexWrap: "wrap", padding: isMobile ? `32px ${px}` : `64px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <div style={{ position: "relative", flex: isMobile ? 1 : "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <Badge>Documento Oficial do Torcedor</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 56, lineHeight: 1.05, color: TEXT, margin: 0 }}>Seu Football Passport</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 22, lineHeight: 1.5, color: BODY, margin: 0 }}>Toda atmosfera vivida, cada arquibancada tremendo e os templos do futebol mundial que você já conquistou. Colecione conquistas de suas viagens.</p>
        </div>
        <div style={{ position: "relative", background: "#fff", border: `2px solid ${GREEN}`, boxShadow: "0px 12px 24px rgba(0,200,83,0.08)", borderRadius: 16, padding: isMobile ? 20 : 32, width: isMobile ? "100%" : 420, maxWidth: "100%", flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>FOOTBALL PASSPORT</p>
            <Award size={22} color={GREEN} />
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ width: 80, height: 100, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden", flexShrink: 0, background: GREEN_BUTTON2, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {userAvatar ? <img src={userAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: "#fff", margin: 0 }}>{initials(userName)}</p>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nome do Titular</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{userName || "—"}</p>
              </div>
              <div>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nível de Acesso</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>BLOQUEADO</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>ID: #PENDENTE</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>ATIVAÇÃO: —</p>
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? `24px ${px} 48px` : `24px ${px} 80px`, display: "flex", flexDirection: "column", gap: 24 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 22 : 32, color: TEXT, margin: 0 }}>O que você desbloqueia com o Passport:</p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
          {features.map(([Ic, title, body]) => (
            <div key={title} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ background: GREEN_BG, width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ic size={18} color={GREEN} />
              </div>
              <div>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{title}</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, lineHeight: 1.4, color: MUTED, margin: "4px 0 0" }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: `0 ${px} 24px` }}>
        <div style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 20 : 26, color: TEXT, margin: 0 }}>Escolha seu plano e desbloqueie agora</p>
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
          </div>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, width: "100%", maxWidth: 720, margin: "0 auto" }}>
            <div style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0 }}>Plano Mensal</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, color: TEXT, margin: 0 }}>R$ 9,90<span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>/mês</span></p>
              <div onClick={loadingPlan ? undefined : () => handleSubscribe("monthly")} style={{ background: BG_ALT, border: `1px solid ${BORDER}`, padding: "12px 20px", borderRadius: 8, textAlign: "center", cursor: loadingPlan ? "default" : "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{loadingPlan === "monthly" ? "Redirecionando..." : "Assinar Mensal"}</p>
              </div>
            </div>
            <div style={{ flex: 1, background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
              <div style={{ position: "absolute", top: -12, right: 20, background: GREEN, padding: "4px 12px", borderRadius: 999 }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: "#fff", margin: 0 }}>ECONOMIZE 16%</p>
              </div>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: GREEN, textTransform: "uppercase", margin: 0 }}>Plano Anual</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, color: TEXT, margin: 0 }}>R$ 99,90<span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>/ano</span></p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>Economia de R$ 18,90/ano</p>
              <div onClick={loadingPlan ? undefined : () => handleSubscribe("annual")} style={{ background: GREEN_BUTTON, padding: "12px 20px", borderRadius: 8, textAlign: "center", cursor: loadingPlan ? "default" : "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{loadingPlan === "annual" ? "Redirecionando..." : "Assinar Anual"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: `0 ${px} 80px` }}>
        <div style={{ background: "#0f172a", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: "#fff", margin: 0 }}>Pronto para planejar sua próxima arquibancada?</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#e2e8f0", margin: 0 }}>Gere um roteiro inteligente personalizado com os melhores clássicos, derbies e sequências possíveis de jogos.</p>
          {onCreateNew && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div onClick={onCreateNew} style={{ background: GREEN_BUTTON, padding: "14px 24px", borderRadius: 999, textAlign: "center", cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", margin: 0 }}>Montar meu roteiro →</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Meu Nível: sistema de XP calculado de verdade a partir dos dados do usuário --- */
const XP_TIERS = [
  { level: 1, name: "Torcedor de Sofá", min: 0, max: 499, icon: "sofa", perk: "Cadastro inicial e rastreamento de estádios" },
  { level: 2, name: "Estreante", min: 500, max: 1499, icon: "mapPin", perk: "Acesso à galeria e badges de conquistas" },
  { level: 3, name: "Groundhopper", min: 1500, max: 4999, icon: "globe", perk: "Desconto de 10% em qualquer roteiro oficial" },
  { level: 4, name: "Veterano", min: 5000, max: 19999, icon: "trophy", perk: "Acesso prioritário a caravanas e grupos de viagem" },
  { level: 5, name: "Lenda", min: 20000, max: Infinity, icon: "crown", perk: "Sorteio de ingressos & Consultoria premium grátis" },
];

function computeTier(xp) {
  return XP_TIERS.find((t) => xp >= t.min && xp <= t.max) || XP_TIERS[0];
}

const TIER_MEDAL_COLORS = { 1: GOLD || "#b78103", 2: "#6b7280", 3: "#cd7f32" };
const TIER_MEDAL_BG = { 1: "#fff9e6", 2: "#f1f5f9", 3: "#fdf4e5" };

function PodiumSpot({ entry, position }) {
  const isMobile = useIsMobile();
  const color = TIER_MEDAL_COLORS[position];
  const bg = TIER_MEDAL_BG[position];
  const isFirst = position === 1;
  const avatarSize = isMobile ? (isFirst ? 52 : 44) : (isFirst ? 88 : 72);
  const blockHeight = isMobile ? (isFirst ? 120 : position === 2 ? 90 : 70) : (isFirst ? 220 : position === 2 ? 160 : 130);
  const initials = (entry.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 16, alignItems: "center", flex: 1, minWidth: 0 }}>
      {isFirst && <Award size={isMobile ? 16 : 32} color={color} />}
      <div style={{ border: `${isFirst ? 3 : 2}px solid ${color}`, borderRadius: 999, padding: isFirst ? 4 : 3, display: "flex" }}>
        <div style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: avatarSize * 0.3, color: TEXT, margin: 0 }}>{initials}</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: isFirst ? 800 : 700, fontSize: isMobile ? (isFirst ? 13 : 12) : (isFirst ? 20 : 18), color: TEXT, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{isMobile ? entry.name.split(" ")[0] : entry.name}</p>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: isMobile ? (isFirst ? 11 : 10) : (isFirst ? 16 : 14), color, margin: 0 }}>{entry.xp.toLocaleString("pt-BR")} XP</p>
        {!isMobile && (
          <div style={{ background: bg, padding: "4px 8px", borderRadius: 4 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color, margin: 0 }}>{entry.tier.toUpperCase()}</p>
          </div>
        )}
      </div>
      <div style={{ background: bg, width: "100%", height: blockHeight, borderRadius: "12px 12px 0 0", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: position === 1 ? "flex-start" : "flex-end", paddingBottom: position === 1 ? 0 : 12, paddingTop: 12 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: isMobile ? (isFirst ? 32 : 20) : (isFirst ? 64 : 40), color, margin: 0 }}>{position}</p>
        {!isFirst && <Award size={isMobile ? 14 : 24} color={color} />}
      </div>
    </div>
  );
}

function RankingRow({ entry, highlighted, isMobile }) {
  const tierColors = { "Lenda": GOLD, "Veterano": "#6b7280", "Groundhopper": GREEN, "Estreante": MUTED, "Torcedor de Sofá": MUTED };
  const tierBg = { "Lenda": GOLD_BG, "Veterano": "#f1f5f9", "Groundhopper": GREEN_BG, "Estreante": "#f1f5f9", "Torcedor de Sofá": "#f1f5f9" };
  const color = tierColors[entry.tier] || MUTED;
  const bg = tierBg[entry.tier] || "#f1f5f9";
  const initials = (entry.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  if (isMobile) {
    return (
      <div style={{ background: highlighted ? "rgba(0,200,83,0.03)" : "#fff", border: highlighted ? `2px solid ${GREEN}` : "none", borderBottom: highlighted ? "none" : `1px solid ${BORDER}`, borderRadius: highlighted ? 12 : 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: highlighted ? GREEN : MUTED, margin: 0, width: 28 }}>#{entry.position}</p>
          <AvatarCircle url={highlighted ? entry.avatarUrl : null} name={entry.name} size={highlighted ? 32 : 24} fontSize={11} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: highlighted ? GREEN : color, margin: 0, textTransform: highlighted ? "uppercase" : "none" }}>{highlighted ? "Sua posição atual" : entry.tier}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: highlighted ? GREEN : TEXT, margin: 0 }}>{entry.xp.toLocaleString("pt-BR")} XP</p>
          <p style={{ fontSize: 16, margin: 0 }}>{entry.flag}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: highlighted ? "rgba(0,200,83,0.03)" : "transparent", border: highlighted ? `2px solid ${GREEN}` : "none", borderRadius: highlighted ? 12 : 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
      <div style={{ display: "flex", gap: 24, alignItems: "center", width: 300 }}>
        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: highlighted ? 16 : 15, color: highlighted ? GREEN : MUTED, margin: 0 }}>#{entry.position}</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <AvatarCircle url={highlighted ? entry.avatarUrl : null} name={entry.name} size={highlighted ? 36 : 32} fontSize={14} />
          <div>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: highlighted ? 15 : 15, color: TEXT, margin: 0 }}>{entry.name}</p>
            {highlighted && <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>Sua posição atual</p>}
          </div>
        </div>
      </div>
      <div style={{ width: 150 }}>
        <div style={{ background: bg, display: "inline-flex", padding: "4px 10px", borderRadius: 4 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color, margin: 0 }}>{entry.tier.toUpperCase()}</p>
        </div>
      </div>
      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: highlighted ? 16 : 14, color: highlighted ? GREEN : TEXT, margin: 0, width: 120, textAlign: "right" }}>{entry.xp.toLocaleString("pt-BR")} XP</p>
      <p style={{ fontSize: 20, margin: 0, width: 80, textAlign: "center" }}>{entry.flag}</p>
    </div>
  );
}

function RankingTorcedores({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [scope, setScope] = useState("nacional");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      setUserName(userData.user?.user_metadata?.name || userData.user?.email || "");
      setUserAvatar(userData.user?.user_metadata?.avatar_url || null);

      setLoading(true);
      try {
        const res = await fetch(`/api/ranking?userId=${userData.user?.id}&scope=${scope}`);
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    })();
  }, [scope]);

  const podium = data?.podium || [];
  const rest = data?.rest || [];
  const myEntry = data?.myEntry;
  const myInTop15 = rest.some((e) => e.userId === myEntry?.userId) || podium.some((e) => e.userId === myEntry?.userId);

  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <AuthedNav active="ranking" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
      <div style={{ padding: isMobile ? `24px ${px}` : `64px 120px`, display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 24 }}>
          <Badge>Comunidade tripsz</Badge>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: isMobile ? "100%" : 700 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: isMobile ? 28 : 40, color: TEXT, margin: 0 }}>Ranking de Torcedores</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, lineHeight: 1.5, color: BODY, margin: 0 }}>Compare seu passaporte com outros viajantes e dispute a liderança no ranking nacional.</p>
            </div>
            <div style={{ background: BORDER, padding: 4, borderRadius: 8, display: "flex", width: isMobile ? "100%" : "auto" }}>
              {[["nacional", "Nacional"], ["global", "Global"]].map(([key, label]) => (
                <div key={key} onClick={() => setScope(key)} style={{ flex: isMobile ? 1 : "none", background: scope === key ? GREEN : "transparent", padding: "10px 24px", borderRadius: 6, textAlign: "center", cursor: "pointer" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: scope === key ? 700 : 500, fontSize: isMobile ? 13 : 14, color: scope === key ? "#fff" : MUTED, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <Loading text="Carregando ranking..." compact />
        ) : podium.length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 40, textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: MUTED, margin: 0 }}>Ainda estamos reunindo torcedores suficientes pro ranking {scope === "nacional" ? "nacional" : "global"} — volte em breve!</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: isMobile ? 8 : 24, alignItems: "flex-end", justifyContent: "center", width: "100%" }}>
              {podium[1] && <PodiumSpot entry={podium[1]} position={2} />}
              {podium[0] && <PodiumSpot entry={podium[0]} position={1} />}
              {podium[2] && <PodiumSpot entry={podium[2]} position={3} />}
            </div>

            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
                  {rest.map((e) => <RankingRow key={e.userId} entry={e} highlighted={false} isMobile />)}
                </div>
                {myEntry && !myInTop15 && <RankingRow entry={myEntry} highlighted isMobile />}
              </div>
            ) : (
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 24px", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ display: "flex", gap: 24, width: 300 }}>
                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: MUTED, margin: 0 }}>POSIÇÃO</p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, margin: 0 }}>TORCEDOR</p>
                  </div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, margin: 0, width: 150 }}>CATEGORIA</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, margin: 0, width: 120, textAlign: "right" }}>PONTUAÇÃO</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, margin: 0, width: 80, textAlign: "center" }}>PAÍS</p>
                </div>
                {rest.map((e, i) => <RankingRow key={e.userId} entry={e} highlighted={false} isMobile={false} />)}
                {myEntry && !myInTop15 && <div style={{ marginTop: 8 }}><RankingRow entry={myEntry} highlighted isMobile={false} /></div>}
              </div>
            )}
          </>
        )}
      </div>
      <AuthedFooter />
    </div>
  );
}

function AssinarStandalone({ onNavigate, onLogout }) {
  const [userInfo, setUserInfo] = useState(null); // null = carregando

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      setUserInfo({
        userId: user?.id || null,
        userEmail: user?.email || null,
        userName: user?.user_metadata?.name || user?.email || "",
        userAvatar: user?.user_metadata?.avatar_url || null,
      });
    })();
  }, []);

  if (!userInfo) {
    return (
      <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
        <AuthedNav active="" userName="" userAvatar={null} onNavigate={onNavigate} onLogout={onLogout} />
        <Loading />
      </div>
    );
  }

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="" userName={userInfo.userName} userAvatar={userInfo.userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
      <PassportPaywall userId={userInfo.userId} userEmail={userInfo.userEmail} userName={userInfo.userName} userAvatar={userInfo.userAvatar} />
      <AuthedFooter />
    </div>
  );
}

function MeuNivel({ onNavigate, onLogout, onCreateNew }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [progress, setProgress] = useState(null);
  const [access, setAccess] = useState(null); // null = carregando

  useEffect(() => {
    (async () => {
      const acc = await checkPassportAccess();
      setAccess(acc);
      if (!acc.hasAccess) return;

      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      setUserName(user?.user_metadata?.name || user?.email || "");
      setUserAvatar(user?.user_metadata?.avatar_url || null);

      // Só jogos REGISTRADOS de verdade contam pra XP — gerar um roteiro
      // sugerido é só uma sugestão de viagem, não uma confirmação de que
      // a pessoa foi ao jogo, então não deveria valer conquista.
      const { data: attendedRows } = await supabase.from("attended_games").select("*");
      const attended = attendedRows || [];

      const stadiums = new Set(attended.map((g) => g.stadium).filter(Boolean));
      const countries = new Set(attended.map((g) => g.country).filter(Boolean));
      const totalGames = attended.length;
      const hasChampions = attended.some((g) => /champions league/i.test(g.competition || ""));
      // "Badges completadas" — mesmos critérios usados em Minhas Conquistas
      // (5+ estádios, 3+ países, alguma partida de Champions).
      const completedBadges = [stadiums.size >= 5, countries.size >= 3, hasChampions].filter(Boolean).length;

      const xp = totalGames * 50 + stadiums.size * 100 + countries.size * 200 + completedBadges * 150;
      setProgress({ xp, totalGames, stadiums: stadiums.size, countries: countries.size });
    })();
  }, []);

  if (access === null) {
    return (
      <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
        <AuthedNav active="nivel" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <Loading />
      </div>
    );
  }
  if (!access.hasAccess) {
    return (
      <div style={{ background: BG, width: "100%" }}>
        <AuthedNav active="nivel" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <PassportPaywall userId={access.userId} userEmail={access.userEmail} userName={userName} userAvatar={userAvatar} onCreateNew={onCreateNew} />
        <AuthedFooter />
      </div>
    );
  }

  const xp = progress?.xp ?? 0;
  const tier = computeTier(xp);
  const nextTier = XP_TIERS[tier.level] || null;
  const tierSpan = tier.max === Infinity ? xp - tier.min || 1 : tier.max - tier.min + 1;
  const xpIntoTier = xp - tier.min;
  const pct = tier.max === Infinity ? 100 : Math.min(100, Math.round((xpIntoTier / tierSpan) * 100));

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="nivel" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ position: "relative", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 64, alignItems: "center", flexWrap: "wrap", padding: isMobile ? `32px ${px}` : `80px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <div style={{ position: "relative", flex: isMobile ? 1 : "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <Badge>Seu Progresso Atual</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 56, lineHeight: 1.05, color: TEXT, margin: 0 }}>Nível do Torcedor</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 22, lineHeight: 1.5, color: BODY, margin: 0 }}>Sua jornada como caçador de estádios. Acumule XP para subir de categoria e garantir benefícios exclusivos na arquibancada.</p>
        </div>
        <div style={{ position: "relative", background: "#fff", border: `2px solid ${GREEN}`, borderRadius: 16, padding: isMobile ? 20 : 32, width: isMobile ? "100%" : 420, maxWidth: "100%", flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>PROGRESSO DO PASSPORT</p>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: GREEN, margin: 0 }}>{xp} / {tier.max === Infinity ? xp : tier.max + 1} XP</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, color: TEXT, margin: 0 }}>Nível {tier.level} — {tier.name}</p>
            <div style={{ background: BORDER, height: 8, borderRadius: 4, width: "100%", overflow: "hidden" }}>
              <div style={{ background: GREEN, height: "100%", width: `${pct}%` }} />
            </div>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>
              {nextTier ? `Mais ${nextTier.min - xp} XP para atingir o nível ${nextTier.name}` : "Nível máximo atingido!"}
            </p>
          </div>
        </div>
      </div>

      <div style={{ background: BG_ALT, display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 40, padding: isMobile ? `24px ${px}` : `80px ${px}` }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 22 : 32, color: TEXT, margin: 0 }}>Categorias de Torcedor</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[...XP_TIERS].reverse().map((t) => {
              const isCurrent = t.level === tier.level;
              const isLocked = t.level > tier.level;
              return (
                <div key={t.level} style={{ background: "#fff", border: isCurrent ? `2px solid ${GREEN}` : `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", gap: 16, alignItems: "center", opacity: isLocked ? 0.6 : 1 }}>
                  <div style={{ background: isCurrent ? GREEN_BG : BG_ALT, width: 44, height: 44, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name={t.icon} size={20} color={isCurrent ? GREEN : MUTED} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{t.name}</p>
                      <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>Nível {t.level} • {t.max === Infinity ? `${t.min}+ XP` : `${t.min}-${t.max} XP`}</p>
                    </div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: "2px 0 0" }}>{t.perk}</p>
                  </div>
                  {isCurrent && <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, margin: 0 }}>ATUAL</p>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ width: isMobile ? "100%" : 460, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Como ganhar XP</p>
            {[["Comparecer a um jogo", "+50 XP"], ["Visitar um novo estádio", "+100 XP"], ["Conhecer um novo país", "+200 XP"], ["Completar uma Badge de conquista", "+150 XP"]].map(([l, v], i, arr) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: i < arr.length - 1 ? 12 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>{l}</p>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: "#fff", margin: 0 }}>Pronto para planejar sua próxima arquibancada?</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#e2e8f0", margin: 0 }}>Gere um roteiro inteligente personalizado com os melhores clássicos, derbies e sequências possíveis de jogos.</p>
            <div onClick={onCreateNew} style={{ background: GREEN_BUTTON, padding: "14px 24px", borderRadius: 8, textAlign: "center", cursor: "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", margin: 0 }}>Montar meu roteiro →</p>
            </div>
          </div>
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}

/* ============================================================
   BUSCAR JOGOS + MEU CALENDÁRIO
   Figma: 477:38637 (resultados), 477:39035 (jogo adicionado),
   477:39438 (meu calendário).
   A busca usa /api/cities/suggest e /api/games/search; os jogos
   salvos ficam na tabela saved_games (ver 2-supabase-saved-games.sql).
   ============================================================ */
const BASE_CITY_KEY = "tripsz_base_city";

function BuscarJogos({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [user, setUser] = useState({ id: null, name: "", avatar: null });
  const [date, setDate] = useState(todayInSaoPaulo());
  const [cityQuery, setCityQuery] = useState("");
  const [city, setCity] = useState(null); // { label, name, lat, lon }
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [radius, setRadius] = useState(150);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searchedWith, setSearchedWith] = useState(null);
  const [error, setError] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [addingId, setAddingId] = useState(null);
  const [lastAdded, setLastAdded] = useState(null);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) {
        onLogout();
        return;
      }
      setUser({ id: u.id, name: u.user_metadata?.name || u.email || "", avatar: u.user_metadata?.avatar_url || null });
      const { data: rows } = await supabase.from("saved_games").select("fixture_id").eq("user_id", u.id);
      setSavedIds(new Set((rows || []).map((r) => r.fixture_id)));
    })();
    // Lembra a última cidade-base, pra pessoa não digitar toda vez.
    try {
      const raw = localStorage.getItem(BASE_CITY_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.label) {
          setCity(saved);
          setCityQuery(saved.label);
        }
      }
    } catch {
      // sem acesso ao armazenamento do navegador — segue sem lembrar
    }
  }, []);

  // Autocomplete da cidade-base.
  useEffect(() => {
    const q = cityQuery.trim();
    if ((city && q === city.label) || q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities/suggest?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setSuggestions(json.suggestions || []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [cityQuery, city]);

  const pickCity = (s) => {
    setCity(s);
    setCityQuery(s.label);
    setSuggestions([]);
    setShowSuggestions(false);
    try {
      localStorage.setItem(BASE_CITY_KEY, JSON.stringify(s));
    } catch {
      // idem
    }
  };

  const handleSearch = async () => {
    setError(null);
    setLastAdded(null);
    let chosen = city;
    // Digitou mas não clicou na sugestão? Usa a primeira (a mais populosa).
    if (!chosen && suggestions.length > 0) {
      chosen = suggestions[0];
      pickCity(chosen);
    }
    if (!chosen) {
      setError("Escolha uma cidade-base da lista de sugestões.");
      return;
    }
    if (!date) {
      setError("Escolha a data do jogo.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ date, lat: String(chosen.lat), lon: String(chosen.lon), radius: String(radius) });
      if (chosen.country) params.set("country", chosen.country);
      const res = await fetch(`/api/games/search?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setResult(null);
        setSearchedWith(null);
        setError(json.message || "Não foi possível buscar os jogos agora.");
        return;
      }
      setResult(json);
      setSearchedWith({ date, radius, cityLabel: chosen.label });
    } catch {
      setResult(null);
      setError("Não foi possível buscar os jogos agora. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (g) => {
    if (!user.id || savedIds.has(g.id) || addingId) return;
    setAddingId(g.id);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { error: insertError } = await supabase.from("saved_games").insert({
        user_id: user.id,
        fixture_id: g.id,
        kickoff: g.kickoff,
        league_name: g.league,
        league_country: g.leagueCountry,
        home_team: g.home,
        home_logo: g.homeLogo,
        away_team: g.away,
        away_logo: g.awayLogo,
        venue_name: g.venue,
        venue_city: g.city,
      });
      // 23505 = esse jogo já estava salvo — trata como sucesso.
      if (insertError && insertError.code !== "23505") throw insertError;
      setSavedIds((prev) => new Set(prev).add(g.id));
      setLastAdded(`${g.home} × ${g.away}`);
    } catch {
      setError("Não foi possível adicionar ao calendário agora. Tente de novo.");
    } finally {
      setAddingId(null);
    }
  };

  const labelStyle = { fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 };
  const fieldStyle = { background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, height: 48, padding: "0 14px", width: "100%", boxSizing: "border-box", fontFamily: FONT_DISPLAY, fontSize: 16, color: TEXT, outline: "none" };
  const cityShort = searchedWith ? cityShortName(searchedWith.cityLabel) : "";

  const renderGame = (g) => {
      const p = kickoffParts(g.kickoff);
      const saved = savedIds.has(g.id);
      const noTime = g.status === "PST" || g.status === "TBD";
      const league = g.leagueCountry && g.leagueCountry !== "World" ? `${g.league} • ${g.leagueCountry}` : g.league;
      return (
        <div key={g.id} style={{ background: "#fff", border: `${saved ? 1.5 : 1}px solid ${saved ? GREEN : BORDER}`, borderRadius: 12, padding: isMobile ? 16 : "20px 24px", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 12 : 32 }}>
          <div style={{ width: isMobile ? "auto" : 96, flexShrink: 0, display: "flex", flexDirection: isMobile ? "row" : "column", alignItems: isMobile ? "baseline" : "flex-start", gap: isMobile ? 10 : 2 }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, margin: 0 }}>{p.dayMonthYear}</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: TEXT, margin: 0 }}>{noTime ? "A definir" : p.time}</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{p.weekdayLong}</p>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: "#008a3a", textTransform: "uppercase", margin: 0 }}>{league}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <TeamBadge name={g.home} url={g.homeLogo} size={26} resolve />
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{g.home} × {g.away}</p>
              <TeamBadge name={g.away} url={g.awayLogo} size={26} resolve />
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <MapPin size={14} color={MUTED} style={{ flexShrink: 0 }} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: 0 }}>{[g.venue, g.city].filter(Boolean).join(" • ") || "Estádio a confirmar"}</p>
            </div>
            {g.approxLocation && <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>Local provável — confirme o estádio</p>}
          </div>
          <div style={{ width: isMobile ? "auto" : 90, flexShrink: 0, textAlign: isMobile ? "left" : "center" }}>
            {g.distanceKm == null ? (
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, color: MUTED, margin: 0 }}>distância indisponível</p>
            ) : (
              <>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{g.distanceKm} km</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, color: MUTED, margin: 0 }}>de {cityShort}</p>
              </>
            )}
          </div>
          {saved ? (
            <div style={{ background: "#eafbf1", borderRadius: 8, padding: "12px 18px", display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={16} color="#008a3a" />
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#008a3a", margin: 0, whiteSpace: "nowrap" }}>No meu calendário</p>
            </div>
          ) : (
            <div onClick={() => handleAdd(g)} style={{ background: GREEN, opacity: addingId === g.id ? 0.6 : 1, borderRadius: 8, padding: "12px 18px", display: "flex", gap: 8, alignItems: "center", justifyContent: "center", cursor: addingId ? "default" : "pointer", flexShrink: 0 }}>
              <Plus size={16} color="#fff" />
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", margin: 0, whiteSpace: "nowrap" }}>{addingId === g.id ? "Adicionando..." : "Adicionar ao calendário"}</p>
            </div>
          )}
        </div>
      );
  };


  return (
    <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
      <AuthedNav active="buscar" userName={user.name} userAvatar={user.avatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ background: "linear-gradient(180deg, #e6f5ec 0%, #f8fafc 100%)", padding: isMobile ? `32px ${px}` : `56px ${px}`, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          <div style={{ background: "#eafbf1", padding: "6px 12px", borderRadius: 4, width: "fit-content" }}>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: "#008a3a", margin: 0 }}>FUTEBOL PELO CAMINHO</p>
          </div>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 36 : 56, lineHeight: 1.05, color: TEXT, margin: 0 }}>Buscar jogos</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 16 : 18, lineHeight: 1.5, color: BODY, margin: 0 }}>Escolha uma data e uma cidade. Encontre sua próxima experiência de arquibancada.</p>
        </div>
        <div onClick={() => onNavigate("calendario")} style={{ background: BG_ALT, borderRadius: 8, padding: "13px 20px", display: "flex", gap: 8, alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
          <Calendar size={20} color={TEXT} />
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0, whiteSpace: "nowrap" }}>Meu calendário</p>
        </div>
      </div>

      <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: isMobile ? `24px ${px}` : `32px ${px}`, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-end", gap: isMobile ? 16 : 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: isMobile ? "100%" : 200 }}>
            <p style={labelStyle}>Data do jogo</p>
            <input type="date" value={date} min={todayInSaoPaulo()} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: isMobile ? "none" : 1, minWidth: 0, position: "relative" }}>
            <p style={labelStyle}>Cidade-base</p>
            <input
              value={cityQuery}
              onChange={(e) => {
                setCityQuery(e.target.value);
                if (city && e.target.value !== city.label) setCity(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Digite uma cidade (ex: São Paulo)"
              style={fieldStyle}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", zIndex: 30, overflow: "hidden" }}>
                {suggestions.map((s) => (
                  <div key={s.label} onMouseDown={() => pickCity(s)} style={{ padding: "12px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 10, alignItems: "center" }}>
                    <MapPin size={14} color={MUTED} />
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={labelStyle}>Raio de busca</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {RADIUS_OPTIONS.map((r) => (
                <div key={r} onClick={() => setRadius(r)} style={{ background: radius === r ? GREEN : BG_ALT, padding: "10px 16px", borderRadius: 999, cursor: "pointer" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: radius === r ? 700 : 500, fontSize: 13, color: radius === r ? "#fff" : BODY, margin: 0, whiteSpace: "nowrap" }}>{r} km</p>
                </div>
              ))}
            </div>
          </div>
          <div onClick={loading ? undefined : handleSearch} style={{ background: GREEN, opacity: loading ? 0.6 : 1, padding: "13px 20px", borderRadius: 8, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", cursor: loading ? "default" : "pointer", flexShrink: 0, height: 48, boxSizing: "border-box" }}>
            <Icon name="search" size={18} color="#fff" />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0, whiteSpace: "nowrap" }}>{loading ? "Buscando..." : "Buscar jogos"}</p>
          </div>
        </div>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, lineHeight: 1.4, color: MUTED, margin: 0 }}>
          Distâncias aproximadas em linha reta, medidas a partir da cidade escolhida. Horários de Brasília.
        </p>
      </div>

      <div style={{ background: BG_ALT, padding: isMobile ? `24px ${px}` : `40px ${px}`, display: "flex", flexDirection: "column", gap: 24, minHeight: 240 }}>
        {lastAdded && (
          <div style={{ background: "#eafbf1", borderRadius: 8, padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={13} color="#fff" />
            </div>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0, flex: 1, minWidth: 200 }}>{lastAdded} foi adicionado ao seu calendário.</p>
            <p onClick={() => onNavigate("calendario")} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#008a3a", margin: 0, cursor: "pointer", whiteSpace: "nowrap" }}>Ver Meu calendário →</p>
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#991b1b", margin: 0 }}>{error}</p>
          </div>
        )}

        {loading && <Loading text="Buscando jogos..." compact />}

        {!loading && !result && !error && (
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Escolha a data, a cidade-base e o raio, e toque em “Buscar jogos”.</p>
        )}

        {!loading && result && searchedWith && (
          <>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: TEXT, margin: 0 }}>
                  {result.total} {result.total === 1 ? "jogo encontrado" : "jogos encontrados"}
                </p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>
                  {formatLongDate(searchedWith.date)} • Até {searchedWith.radius} km de {cityWithoutCountry(searchedWith.cityLabel)}
                </p>
              </div>
              {result.total > 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>Mais perto da cidade-base</p>}
            </div>

            <div style={{ background: GOLD_BG, borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
              <Info size={18} color={GOLD} style={{ flexShrink: 0 }} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.5, color: BODY, margin: 0 }}>
                Datas e horários podem mudar — confira no site oficial do clube antes de ir. Salvar um jogo não reserva ingressos.
              </p>
            </div>

            {result.stale && (
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: GOLD, margin: 0 }}>Nossa fonte de dados está instável agora — esses jogos podem estar um pouco desatualizados.</p>
            )}

            {result.total === 0 && !(result.unconfirmed || []).length ? (
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Nenhum jogo encontrado nesse raio</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Tente aumentar o raio de busca ou escolher outra data.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {result.games.map(renderGame)}
              </div>
            )}

            {(result.unconfirmed || []).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Estádio não confirmado</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>
                    Jogos do mesmo país ainda sem local definido — podem estar dentro ou fora do raio escolhido.
                  </p>
                </div>
                {result.unconfirmed.map(renderGame)}
              </div>
            )}

            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, textAlign: "center", margin: 0 }}>
              TODOS OS JOGOS DESTA BUSCA • Ajuste a data ou o raio para explorar mais.
            </p>
          </>
        )}
      </div>

      <AuthedFooter />
    </div>
  );
}

function MeuCalendario({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [user, setUser] = useState({ id: null, name: "", avatar: null });
  const [games, setGames] = useState(null); // null = carregando
  const [view, setView] = useState(() => {
    const [y, m] = todayInSaoPaulo().split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) {
        onLogout();
        return;
      }
      setUser({ id: u.id, name: u.user_metadata?.name || u.email || "", avatar: u.user_metadata?.avatar_url || null });
      const { data: rows, error: loadError } = await supabase
        .from("saved_games")
        .select("*")
        .eq("user_id", u.id)
        .order("kickoff", { ascending: true });
      if (loadError) {
        setError("Não foi possível carregar seu calendário agora.");
        setGames([]);
        return;
      }
      const list = (rows || []).map((g) => ({ ...g, parts: kickoffParts(g.kickoff) }));
      setGames(list);
      // Se o mês atual está vazio mas existe um jogo futuro, já abre no mês dele.
      const today = todayInSaoPaulo();
      const [ty, tm] = today.split("-").map(Number);
      const hasThisMonth = list.some((g) => g.parts.year === ty && g.parts.month === tm - 1);
      const nextGame = list.find((g) => g.parts.dateKey >= today);
      if (!hasThisMonth && nextGame) setView({ year: nextGame.parts.year, month: nextGame.parts.month });
    })();
  }, []);

  const handleRemove = async (g) => {
    if (removingId) return;
    setRemovingId(g.id);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { error: deleteError } = await supabase.from("saved_games").delete().eq("id", g.id);
      if (deleteError) throw deleteError;
      setGames((prev) => prev.filter((x) => x.id !== g.id));
    } catch {
      setError("Não foi possível remover o jogo agora. Tente de novo.");
    } finally {
      setRemovingId(null);
    }
  };

  const loaded = games !== null;
  const daysWithGames = useMemo(() => new Set((games || []).map((g) => g.parts.dateKey)), [games]);
  const monthGames = useMemo(
    () => (games || []).filter((g) => g.parts.year === view.year && g.parts.month === view.month),
    [games, view]
  );
  const stadiumsCount = new Set(monthGames.map((g) => g.venue_name).filter(Boolean)).size;
  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view]);
  const nowMs = Date.now();
  const goMonth = (delta) => setView((v) => shiftMonth(v.year, v.month, delta));

  return (
    <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
      <AuthedNav active="calendario" userName={user.name} userAvatar={user.avatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ background: "linear-gradient(180deg, #e6f5ec 0%, #f8fafc 100%)", padding: isMobile ? `32px ${px}` : `56px ${px}`, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          <div style={{ background: "#eafbf1", padding: "6px 12px", borderRadius: 4, width: "fit-content" }}>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: "#008a3a", margin: 0 }}>SUA PRÓXIMA ARQUIBANCADA</p>
          </div>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 36 : 56, lineHeight: 1.05, color: TEXT, margin: 0 }}>Meu calendário</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 16 : 18, lineHeight: 1.5, color: BODY, margin: 0 }}>Os jogos que você quer viver, organizados em um só lugar.</p>
        </div>
        <div onClick={() => onNavigate("buscar")} style={{ background: GREEN, borderRadius: 8, padding: "13px 20px", display: "flex", gap: 8, alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
          <Icon name="search" size={18} color="#fff" />
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0, whiteSpace: "nowrap" }}>Buscar jogos</p>
        </div>
      </div>

      <div style={{ background: BG_ALT, padding: isMobile ? `24px ${px}` : `40px ${px}`, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 20 : 24, color: TEXT, margin: 0 }}>Sua agenda de {monthName(view.month)}</p>
          <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0 }}>
            {monthGames.length} {monthGames.length === 1 ? "jogo salvo" : "jogos salvos"} • {stadiumsCount} {stadiumsCount === 1 ? "estádio" : "estádios"}
          </p>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#991b1b", margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, alignItems: "flex-start" }}>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 16 : 24, display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24, width: isMobile ? "100%" : "auto", flex: isMobile ? "none" : "1.3 1 0", minWidth: 0, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{monthTitle(view.year, view.month)}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <div onClick={() => goMonth(-1)} style={{ background: BG_ALT, width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <ChevronLeft size={20} color={TEXT} />
                </div>
                <div onClick={() => goMonth(1)} style={{ background: BG_ALT, width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <ChevronRight size={20} color={TEXT} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex" }}>
              {WEEKDAY_HEADERS.map((d) => (
                <p key={d} style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 11, color: MUTED, textAlign: "center", margin: 0 }}>{d}</p>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {grid.map((week, wi) => (
                <div key={wi} style={{ display: "flex", gap: 6 }}>
                  {week.map((cell) => {
                    const marked = daysWithGames.has(cell.dateKey);
                    return (
                      <div key={cell.dateKey} style={{ flex: 1, minWidth: 0, height: isMobile ? 48 : 76, borderRadius: 8, background: marked ? "#eafbf1" : cell.inMonth ? BG : "#fff", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center" }}>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: marked ? 700 : 400, fontSize: 15, color: marked ? "#008a3a" : cell.inMonth ? TEXT : "#94a3b8", margin: 0 }}>{cell.day}</p>
                        {marked && <div style={{ width: 6, height: 6, borderRadius: 3, background: GREEN }} />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: GREEN }} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Dia com jogo no seu calendário</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: isMobile ? "none" : "1 1 0", width: isMobile ? "100%" : "auto", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 4 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Próximos jogos que quero ir</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{monthTitle(view.year, view.month)}</p>
            </div>

            {!loaded && <Loading text="Carregando seu calendário..." compact />}

            {loaded && monthGames.length === 0 && (
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Você ainda não salvou nenhum jogo em {monthName(view.month)}.</p>
                <p onClick={() => onNavigate("buscar")} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0, cursor: "pointer" }}>Buscar jogos →</p>
              </div>
            )}

            {monthGames.map((g) => {
              const past = new Date(g.kickoff).getTime() < nowMs;
              const recent = nowMs - new Date(g.created_at).getTime() < 24 * 3600 * 1000;
              const league = g.league_country && g.league_country !== "World" ? `${g.league_name} • ${g.league_country}` : g.league_name;
              return (
                <div key={g.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 10, opacity: past ? 0.7 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: "#008a3a", textTransform: "uppercase", margin: 0 }}>
                      {g.parts.weekdayAbbr}, {String(g.parts.day).padStart(2, "0")} {g.parts.monthAbbr} • {g.parts.time}
                    </p>
                    {past ? (
                      <div style={{ background: BG_ALT, padding: "4px 8px", borderRadius: 4 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, color: MUTED, margin: 0 }}>JÁ PASSOU</p>
                      </div>
                    ) : recent ? (
                      <div style={{ background: "#eafbf1", padding: "4px 8px", borderRadius: 4 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, color: "#008a3a", margin: 0 }}>RECÉM-ADICIONADO</p>
                      </div>
                    ) : null}
                  </div>
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>{league}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <TeamBadge name={g.home_team} url={g.home_logo} size={26} resolve />
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{g.home_team} × {g.away_team}</p>
                    <TeamBadge name={g.away_team} url={g.away_logo} size={26} resolve />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {g.venue_name && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>{g.venue_name}</p>}
                    {g.venue_city && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>{g.venue_city}</p>}
                  </div>
                  <p onClick={() => handleRemove(g)} style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, textDecoration: "underline", margin: 0, cursor: removingId ? "default" : "pointer", width: "fit-content" }}>
                    {removingId === g.id ? "Removendo..." : "Remover do calendário"}
                  </p>
                </div>
              );
            })}

            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.5, color: MUTED, margin: 0 }}>Horários de Brasília. Salvar um jogo não reserva ingressos.</p>
          </div>
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}

function MeusJogosHistorico({ onNavigate, onLogout, onRegisterNew }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [games, setGames] = useState(null);
  const [tab, setTab] = useState("todos");
  const [search, setSearch] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("todas");
  const [access, setAccess] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const loadGames = async () => {
    const acc = await checkPassportAccess();
    setAccess(acc);
    if (!acc.hasAccess) return;

    const supabase = supabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setUserName(user?.user_metadata?.name || user?.email || "");
    setUserAvatar(user?.user_metadata?.avatar_url || null);

    const { data } = await supabase.from("attended_games").select("*").order("match_date", { ascending: false });
    setGames(data || []);
  };

  useEffect(() => {
    loadGames();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Remover este jogo do seu histórico?")) return;
    const supabase = supabaseBrowser();
    await supabase.from("attended_games").delete().eq("id", id);
    loadGames();
  };

  const all = games || [];
  const stadiums = new Set(all.map((g) => g.stadium).filter(Boolean));
  const countries = new Set(all.map((g) => g.country).filter(Boolean));
  const seasonByKey = new Map();
  all.forEach((g) => {
    const se = seasonOfGame(g);
    seasonByKey.set(se.key, se);
  });
  const seasons = Array.from(seasonByKey.values()).sort(compareSeasonsDesc); // [{ key, label, year, kind }]

  const filtered = all.filter((g) => {
    if (tab === "tripsz" && g.source !== "api") return false;
    if (tab === "manuais" && g.source !== "manual") return false;
    if (seasonFilter !== "todas" && seasonOfGame(g).key !== seasonFilter) return false;
    if (search && !(g.stadium || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = {};
  filtered.forEach((g) => {
    const k = seasonOfGame(g).key;
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(g);
  });
  const orderedSeasons = Object.keys(grouped).sort((a, b) => compareSeasonsDesc(seasonByKey.get(a), seasonByKey.get(b)));

  if (access === null) {
    return (
      <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
        <AuthedNav active="jogos" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <Loading />
      </div>
    );
  }
  if (!access.hasAccess) {
    return (
      <div style={{ background: BG, width: "100%" }}>
        <AuthedNav active="jogos" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <PassportPaywall userId={access.userId} userEmail={access.userEmail} userName={userName} userAvatar={userAvatar} />
        <AuthedFooter />
      </div>
    );
  }

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="jogos" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: isMobile ? `24px ${px} 8px` : `48px ${px} 8px` }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 40, lineHeight: 1.1, color: TEXT, margin: 0 }}>Meus Jogos</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, lineHeight: 1.5, color: BODY, margin: 0 }}>
          {all.length} {all.length === 1 ? "jogo" : "jogos"} · {stadiums.size} {stadiums.size === 1 ? "estádio" : "estádios"} · {countries.size} {countries.size === 1 ? "país" : "países"}
        </p>
      </div>

      <div style={{ background: BG_ALT, padding: isMobile ? `24px ${px}` : `80px ${px}`, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[["todos", "Todos"], ["tripsz", "Via Tripsz"], ["manuais", "Manuais"]].map(([id, label]) => (
              <div key={id} onClick={() => setTab(id)} style={{ background: tab === id ? GREEN_BG : "#fff", border: `1px solid ${tab === id ? GREEN : BORDER}`, padding: "8px 16px", borderRadius: 999, cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: tab === id ? 700 : 500, fontSize: 14, color: tab === id ? GREEN : BODY, margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
          <div onClick={onRegisterNew} style={{ background: GREEN_BUTTON, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "12px 20px", borderRadius: 8, cursor: "pointer" }}>
            <Icon name="pen" size={16} color={TEXT} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, textTransform: "uppercase", margin: 0 }}>Registrar Novo Jogo</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16 }}>
          <div style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 8 }}>
            <Icon name="search" size={18} color={MUTED} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por estádio..." style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT }} />
          </div>
          <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14, color: TEXT, width: isMobile ? "100%" : 240 }}>
            <option value="todas">Todas as temporadas</option>
            {seasons.map((se) => <option key={se.key} value={se.key}>Temporada {se.label}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, color: TEXT, margin: 0 }}>Histórico de Partidas</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Filtrado por: {tab === "todos" ? "Todos" : tab === "tripsz" ? "Via Tripsz" : "Manuais"}</p>
        </div>

        {games === null && <Loading />}
        {games !== null && filtered.length === 0 && (
          <div style={{ background: "#fff", border: `1px dashed ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: BODY, margin: 0 }}>Nenhum jogo encontrado. Registre os jogos que você já assistiu pra eles contarem no seu Football Passport.</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {orderedSeasons.map((season) => (
            <div key={season} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: TEXT, margin: 0 }}>Temporada {seasonByKey.get(season)?.label}</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: MUTED, margin: 0 }}>{grouped[season].length} jogo(s)</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {grouped[season].map((g) => {
                  const expanded = expandedId === g.id;
                  return (
                    <div key={g.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", gap: isMobile ? 8 : 24, alignItems: "center", flexWrap: "wrap" }}>
                          <p style={{ fontFamily: FONT_MONO, fontSize: 13, color: MUTED, margin: 0 }}>{new Date(g.match_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <TeamBadge name={g.home_team} url={g.home_logo} size={22} resolve />
                            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: TEXT, margin: 0 }}>{g.home_team} {g.home_score != null && g.away_score != null ? `${g.home_score}×${g.away_score}` : "×"} {g.away_team}</p>
                            <TeamBadge name={g.away_team} url={g.away_logo} size={22} resolve />
                          </div>
                        </div>
                        <div style={{ background: g.source === "api" ? GREEN_BG : BG_ALT, border: `1px solid ${g.source === "api" ? GREEN : BORDER}`, padding: "4px 10px", borderRadius: 4 }}>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: g.source === "api" ? GREEN : BODY, margin: 0 }}>{g.source === "api" ? "Via Tripsz" : "Manual ✓"}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <MapPin size={16} color={BODY} />
                          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>{g.stadium || g.country}</p>
                        </div>
                        <div onClick={() => setExpandedId(expanded ? null : g.id)} style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>Ver detalhes da experiência</p>
                          <Icon name={expanded ? "chevronDown" : "chevronRight"} size={14} color={GREEN} />
                        </div>
                      </div>
                      {expanded && (
                        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {g.competition && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: 0 }}>Competição: {g.competition}</p>}
                            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: 0 }}>{g.city ? `${g.city}, ` : ""}{g.country}</p>
                          </div>
                          <p onClick={() => handleDelete(g.id)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#ef4444", margin: 0, cursor: "pointer" }}>Remover este jogo</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}

/* --- Registrar Jogo: fluxo guiado, busca por estádio na API-Football --- */
function RegistrarJogo({ onNavigate, onLogout, onDone }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);

  const [stadiumQuery, setStadiumQuery] = useState("");
  const [searchMode, setSearchMode] = useState("estadio"); // "estadio" | "clube"
  const [seasonValue, setSeasonValue] = useState(() => seasonOptionGroups().eu[0].value); // "eu:2026" (2026/27) ou "cal:2026" (ano de 2026)
  const { year: season, label: seasonText } = parseSeasonValue(seasonValue);
  const [competitionFilter, setCompetitionFilter] = useState("todas");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [venue, setVenue] = useState(null);
  const [games, setGames] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ home: "", away: "", date: "", stadium: "", city: "", country: "", competition: "" });
  const [access, setAccess] = useState(null);
  const [addedThisSession, setAddedThisSession] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [csvRows, setCsvRows] = useState([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [csvBatchIndex, setCsvBatchIndex] = useState(0);
  const [csvResolving, setCsvResolving] = useState(null); // { done, total } enquanto reconhece os jogos
  const [csvNote, setCsvNote] = useState(null);
  const CSV_BATCH_SIZE = 10;
  // Autocomplete nos campos de cada card do lote — guarda qual
  // linha+campo está em foco, e as sugestões pra ele, só um de cada vez.
  const [csvActiveField, setCsvActiveField] = useState(null); // { rowId, field: 'stadium' | 'home' | 'away' }
  const [csvSuggestions, setCsvSuggestions] = useState([]);
  const [csvSuggestLoading, setCsvSuggestLoading] = useState(false);
  const [csvSuggestError, setCsvSuggestError] = useState(null);

  useEffect(() => {
    if (!csvActiveField) return;
    const row = csvRows.find((r) => r.rowId === csvActiveField.rowId);
    const query = (row ? row[csvActiveField.field] : "").trim();
    if (!query || query.length < 3) {
      setCsvSuggestions([]);
      setCsvSuggestLoading(false);
      setCsvSuggestError(null);
      return;
    }
    setCsvSuggestLoading(true);
    setCsvSuggestError(null);
    const timer = setTimeout(async () => {
      try {
        const url = csvActiveField.field === "stadium"
          ? `/api/attended-games/search-stadium/suggest?q=${encodeURIComponent(query)}`
          : `/api/teams/suggest?q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        setCsvSuggestions(data.suggestions || []);
      } catch (e) {
        setCsvSuggestions([]);
        setCsvSuggestError("Erro ao buscar — tenta de novo em instantes.");
      } finally {
        setCsvSuggestLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvActiveField, csvRows]);

  const pickCsvSuggestion = (rowId, field, value, logo) => {
    updateCsvRow(rowId, field, value);
    if (field === "home") updateCsvRow(rowId, "homeLogo", logo || null);
    if (field === "away") updateCsvRow(rowId, "awayLogo", logo || null);
    setCsvActiveField(null);
    setCsvSuggestions([]);
  };

  // Autocomplete com debounce — só busca sugestões depois que a pessoa
  // parar de digitar por meio segundo, e só a partir de 3 letras, pra
  // não gastar a cota da API a cada tecla apertada.
  useEffect(() => {
    if (stadiumQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const endpoint = searchMode === "clube"
          ? `/api/teams/suggest?q=${encodeURIComponent(stadiumQuery)}`
          : searchMode === "selecao"
          ? `/api/teams/suggest?q=${encodeURIComponent(stadiumQuery)}&mode=selecao`
          : `/api/attended-games/search-stadium/suggest?q=${encodeURIComponent(stadiumQuery)}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [stadiumQuery, searchMode]);

  const pickSuggestion = (name) => {
    setStadiumQuery(name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  useEffect(() => {
    (async () => {
      const acc = await checkPassportAccess();
      setAccess(acc);
      if (!acc.hasAccess) return;

      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      setUserName(data.user?.user_metadata?.name || data.user?.email || "");
      setUserAvatar(data.user?.user_metadata?.avatar_url || null);
    })();
  }, []);

  const handleSearch = async () => {
    if (!stadiumQuery.trim()) return setError(searchMode === "clube" ? "Digite o nome de um clube." : searchMode === "selecao" ? "Digite o nome de uma seleção." : "Digite o nome de um estádio.");
    setError(null);
    setLoading(true);
    setVenue(null);
    setGames([]);
    setSelectedIds(new Set());
    setCompetitionFilter("todas");
    try {
      if (searchMode === "clube" || searchMode === "selecao") {
        const modeParam = searchMode === "selecao" ? "&mode=selecao" : "";
        const res = await fetch(`/api/attended-games/search-team?team=${encodeURIComponent(stadiumQuery)}&season=${season}${modeParam}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro na busca.");
        if (!data.found) {
          setShowManual(true);
          setManual((m) => ({ ...m, home: stadiumQuery }));
          const noun = searchMode === "selecao" ? "a seleção" : "o clube";
          setError(data.reason === "sem_jogos_no_periodo" ? `Encontramos ${noun}, mas nenhum jogo na temporada ${seasonText} — tente outro ano, ou preencha manualmente.` : `Não encontramos ${searchMode === "selecao" ? "essa seleção" : "esse clube"} na nossa base — preencha manualmente.`);
          return;
        }
        setVenue({ name: data.club.name, city: data.club.city, country: data.club.country, logo: data.club.logo, isClub: true });
        setGames(data.games);
        setShowManual(false);
        return;
      }

      const res = await fetch(`/api/attended-games/search-stadium?stadium=${encodeURIComponent(stadiumQuery)}&season=${season}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na busca.");
      if (!data.found) {
        setShowManual(true);
        if (data.reason === "sem_jogos_no_periodo") {
          setManual((m) => ({ ...m, stadium: data.venue?.name || stadiumQuery, city: data.venue?.city || "", country: data.venue?.country || "" }));
          setError(`Encontramos o estádio, mas nenhum jogo na temporada ${seasonText} — tente outro ano, ou preencha manualmente.`);
        } else {
          setError("Não encontramos esse estádio na nossa base — preencha manualmente.");
        }
        return;
      }
      setVenue(data.venue);
      setGames(data.games);
      setShowManual(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const [savingId, setSavingId] = useState(null);

  // Clicar em "+ Adicionar" já salva aquele jogo na hora — antes exigia
  // um segundo clique em "Adicionar à viagem" pra confirmar em lote, o
  // que dava a impressão de que nada tinha sido salvo.
  const handleAddGame = async (g) => {
    if (selectedIds.has(g.apiFixtureId) || savingId) return;
    if (access && !access.isPaid && access.gamesCount + addedThisSession >= access.gamesLimit) {
      setError(`Você atingiu o limite de ${access.gamesLimit} jogos do plano grátis. Assine pra registrar mais.`);
      return;
    }
    setSavingId(g.apiFixtureId);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");

      const { error: insertError } = await supabase.from("attended_games").insert({
        user_id: userId,
        source: "api",
        api_fixture_id: g.apiFixtureId,
        home_team: g.home,
        away_team: g.away,
        home_logo: g.homeLogo,
        away_logo: g.awayLogo,
        home_score: g.homeScore,
        away_score: g.awayScore,
        match_date: g.date.split("T")[0],
        stadium: g.stadium || venue.name,
        city: g.city || venue.city,
        country: g.country || venue.country,
        competition: g.competition,
      });
      if (insertError) throw insertError;
      setSelectedIds((prev) => new Set(prev).add(g.apiFixtureId));
      setAddedThisSession((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  // Importação de CSV — não chama a API-Football pra nada aqui de
  // propósito (confirmar cada linha na API estouraria nossa cota de 100
  // chamadas/dia rapidinho). Os dados vêm direto do que a pessoa trouxe.
  const CSV_TEMPLATE_HEADER = "data,estadio,cidade,pais,mandante,visitante,placar_mandante,placar_visitante,competicao";
  const downloadCsvTemplate = () => {
    const example = "2024-08-24,Anfield,Liverpool,Inglaterra,Liverpool,Brentford,2,1,Premier League";
    const blob = new Blob([`${CSV_TEMPLATE_HEADER}\n${example}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-jogos-tripsz.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Uma linha do export do Futbology -> linha de revisão. A leitura do texto
  // (letras disfarçadas, "M" apagado, data, placar) está em lib/futbologyParse.js;
  // quem descobre estádio/mandante/visitante é o reconhecimento automático
  // (resolveCsvRows, abaixo), que casa a linha com o jogo real.
  const toFutbologyRow = (rawLine, rowId) => {
    const p = parseFutbologyLine(rawLine);
    if (!p) return null;
    return {
      rowId,
      include: true,
      date: p.date,
      rawDate: p.rawDate || "(confira a data)",
      stadium: "",
      city: "",
      country: guessCountryFromCompetition(p.competition),
      home: "",
      away: "",
      combinedText: p.text, // estádio + mandante + visitante juntos
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      competition: p.competition,
      needsManualSplit: true,
      autoState: "pending", // pending | matched | unmatched
    };
  };

  // Reconhecimento automático: manda as linhas (poucas por vez, agrupadas por
  // data) pro servidor, que acha o jogo real e devolve times, escudos,
  // estádio, cidade e país.
  const resolveCsvRows = async (rows) => {
    const todo = rows.filter((r) => r.date && r.homeScore !== "").sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    if (todo.length === 0) return;
    const CHUNK = 6;
    let matched = 0;
    let planBlocked = false;
    setCsvNote(null);
    setCsvResolving({ done: 0, total: todo.length });
    for (let i = 0; i < todo.length; i += CHUNK) {
      const chunk = todo.slice(i, i + CHUNK);
      let results = [];
      try {
        const res = await authFetch("/api/attended-games/futbology-resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk.map((r) => ({ rowId: r.rowId, date: r.date, text: r.combinedText, homeScore: r.homeScore, awayScore: r.awayScore })) }),
        });
        const data = await res.json();
        if (res.ok) results = data.results || [];
      } catch {
        // falhou este lote: as linhas ficam pra preencher na mão
      }
      const byId = new Map(results.map((r) => [r.rowId, r]));
      if (results.some((r) => r.reason === "plano")) planBlocked = true;
      matched += results.filter((r) => r.match).length;
      setCsvRows((prev) =>
        prev.map((row) => {
          const r = byId.get(row.rowId);
          if (!r || row.autoState !== "pending") return row;
          if (!r.match) return { ...row, autoState: "unmatched" };
          const m = r.match;
          return {
            ...row,
            autoState: "matched",
            needsManualSplit: false,
            home: m.home,
            away: m.away,
            homeLogo: m.homeLogo,
            awayLogo: m.awayLogo,
            stadium: m.stadium || "",
            city: m.city || "",
            country: m.country || row.country,
            competition: m.competition || row.competition,
            apiFixtureId: m.apiFixtureId,
          };
        })
      );
      setCsvResolving({ done: Math.min(i + CHUNK, todo.length), total: todo.length });
    }
    setCsvResolving(null);
    setCsvRows((prev) => prev.map((row) => (row.autoState === "pending" ? { ...row, autoState: "unmatched" } : row)));
    setCsvNote(
      planBlocked
        ? `Reconhecemos ${matched} de ${todo.length} jogos. Os mais antigos não estão disponíveis na nossa fonte de dados — preencha esses à mão.`
        : `Reconhecemos ${matched} de ${todo.length} jogos automaticamente.${matched < todo.length ? " Os demais você completa abaixo." : ""}`
    );
  };

  const HEADER_ALIASES = {
    data: ["data", "date"],
    estadio: ["estadio", "estádio", "stadium", "venue"],
    cidade: ["cidade", "city"],
    pais: ["pais", "país", "country"],
    mandante: ["mandante", "home", "home_team", "mandante_time"],
    visitante: ["visitante", "away", "away_team"],
    placar_mandante: ["placar_mandante", "gols_mandante", "home_score"],
    placar_visitante: ["placar_visitante", "gols_visitante", "away_score"],
    competicao: ["competicao", "competição", "competition", "liga"],
  };

  const parseCsvDate = (raw) => {
    if (!raw) return null;
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (iso.test(raw.trim())) return raw.trim();
    const br = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    const d = new Date(raw);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
    return null;
  };

  const handleCsvFile = async (file) => {
    setCsvError(null);
    setCsvResult(null);
    setCsvFileName(file.name);
    setCsvBatchIndex(0);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setCsvError("O arquivo está vazio ou só tem o cabeçalho.");
        return;
      }
      const rawHeaders = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
      const colIndex = {};
      Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
        const idx = rawHeaders.findIndex((h) => aliases.includes(h));
        if (idx !== -1) colIndex[key] = idx;
      });

      // Sem cabeçalho reconhecido, mas com o padrão "texto ; competição.%"
      // em pelo menos uma linha? Provavelmente é um export tipo
      // Futbology — usa o parser específico pra esse formato.
      if (colIndex.mandante === undefined || colIndex.visitante === undefined || colIndex.data === undefined) {
        const looksLikeFutbology = lines.some((l) => /;.*\.%\s*$/.test(l));
        if (looksLikeFutbology) {
          const rows = lines.map((line, i) => toFutbologyRow(line, i)).filter(Boolean);
          if (rows.length === 0) {
            setCsvError("Reconhecemos o formato Futbology, mas não conseguimos ler nenhuma linha dele. Confere se o arquivo não foi alterado.");
            return;
          }
          setCsvRows(rows);
          resolveCsvRows(rows);
          return;
        }
        setCsvError('O arquivo precisa ter pelo menos as colunas "data", "mandante" e "visitante". Baixe nosso modelo pra ver o formato certo.');
        return;
      }

      const rows = lines.slice(1).map((line, i) => {
        const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const get = (key) => (colIndex[key] !== undefined ? cells[colIndex[key]] || "" : "");
        return {
          rowId: i,
          include: true,
          date: parseCsvDate(get("data")),
          rawDate: get("data"),
          stadium: get("estadio"),
          city: get("cidade"),
          country: get("pais"),
          home: get("mandante"),
          away: get("visitante"),
          homeScore: get("placar_mandante"),
          awayScore: get("placar_visitante"),
          competition: get("competicao"),
        };
      });
      setCsvRows(rows);
    } catch (e) {
      setCsvError("Não foi possível ler esse arquivo. Confirma que é um .csv de verdade.");
    }
  };

  const updateCsvRow = (rowId, field, value) => {
    setCsvRows((rows) => rows.map((r) => (r.rowId === rowId ? { ...r, [field]: value } : r)));
  };

  const handleCsvImport = async (uptoIndex) => {
    const reviewedRows = uptoIndex !== undefined ? csvRows.slice(0, uptoIndex) : csvRows;
    const toImport = reviewedRows.filter((r) => r.include && r.date && r.home && r.away && r.country);
    const skippedCount = reviewedRows.length - toImport.length;
    if (toImport.length === 0) {
      setCsvError("Nenhum jogo revisado até aqui ficou pronto pra importar — confirma que pelo menos um tem data, mandante, visitante e país preenchidos, e não foi marcado como pulado.");
      return;
    }
    setCsvImporting(true);
    setCsvError(null);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");

      let successCount = 0;
      let failCount = 0;
      for (const row of toImport) {
        const { error: insertError } = await supabase.from("attended_games").insert({
          user_id: userId,
          source: "csv",
          api_fixture_id: row.apiFixtureId || null,
          home_team: row.home,
          away_team: row.away,
          home_logo: row.homeLogo || null,
          away_logo: row.awayLogo || null,
          home_score: row.homeScore ? parseInt(row.homeScore, 10) : null,
          away_score: row.awayScore ? parseInt(row.awayScore, 10) : null,
          match_date: row.date,
          stadium: row.stadium || null,
          city: row.city || null,
          country: row.country,
          competition: row.competition || null,
        });
        if (insertError) failCount += 1;
        else successCount += 1;
      }
      setCsvResult({ successCount, skippedCount: skippedCount + failCount });
      setCsvRows([]);
    } catch (e) {
      setCsvError(e.message || "Não foi possível importar os jogos.");
    } finally {
      setCsvImporting(false);
    }
  };

  const handleManualSave = async () => {
    if (!manual.home || !manual.away || !manual.date || !manual.country) {
      return setError("Preencha pelo menos os times, a data e o país.");
    }
    if (access && !access.isPaid && access.gamesCount + addedThisSession >= access.gamesLimit) {
      return setError(`Você atingiu o limite de ${access.gamesLimit} jogos do plano grátis. Assine pra registrar mais.`);
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");
      const { error: insertError } = await supabase.from("attended_games").insert({
        user_id: userId,
        source: "manual",
        home_team: manual.home,
        away_team: manual.away,
        match_date: manual.date,
        stadium: manual.stadium || null,
        city: manual.city || null,
        country: manual.country,
        competition: manual.competition || null,
      });
      if (insertError) throw insertError;
      setAddedThisSession((n) => n + 1);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = { width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, outline: "none" };
  const distinctCompetitions = [...new Set(games.map((g) => g.competition).filter(Boolean))];
  const filteredGames = competitionFilter === "todas" ? games : games.filter((g) => g.competition === competitionFilter);

  if (access === null) {
    return (
      <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
        <AuthedNav active="jogos" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <Loading />
      </div>
    );
  }
  if (!access.hasAccess) {
    return (
      <div style={{ background: BG, width: "100%" }}>
        <AuthedNav active="jogos" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <PassportPaywall userId={access.userId} userEmail={access.userEmail} userName={userName} userAvatar={userAvatar} />
        <AuthedFooter />
      </div>
    );
  }

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="jogos" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: isMobile ? `24px ${px} 8px` : `48px ${px} 8px` }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 40, lineHeight: 1.1, color: TEXT, margin: 0 }}>Registre um Jogo</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, lineHeight: 1.5, color: BODY, margin: 0 }}>Adicione jogos que você já esteve para completar seu Football Passport e subir seu nível de torcedor.</p>
        {!access.isPaid && (() => {
          const used = Math.min(access.gamesCount + addedThisSession, access.gamesLimit);
          const pct = Math.round((used / access.gamesLimit) * 100);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, color: used >= access.gamesLimit ? "#dc2626" : MUTED, margin: 0 }}>
                {used}/{access.gamesLimit} jogos do plano grátis
              </p>
              <div style={{ background: BG_ALT, height: 6, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ background: used >= access.gamesLimit ? "#dc2626" : GREEN, height: "100%", width: `${pct}%`, borderRadius: 999 }} />
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{ background: BG_ALT, display: "flex", flexDirection: "column", alignItems: "center", padding: isMobile ? `24px ${px}` : `80px ${px}` }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 40, width: "100%", maxWidth: 960, display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
            <div>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Etapa 1 · Busca</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: "6px 0 0" }}>Busque pelo estádio ou clube</p>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
              {[["estadio", "Estádio"], ["clube", "Clube"], ["selecao", "Seleção"], ["futbology", "Futbology"]].map(([mode, label]) => (
                <div key={mode} onClick={() => { setSearchMode(mode); setStadiumQuery(""); setVenue(null); setGames([]); setShowManual(false); setError(null); }} style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: searchMode === mode ? TEXT : MUTED, margin: 0 }}>{label}</p>
                    {mode === "futbology" && !access.isPaid && <Lock size={12} color={MUTED} />}
                  </div>
                  <div style={{ background: searchMode === mode ? GREEN : BORDER, height: 2, borderRadius: 1, width: searchMode === mode ? 72 : 44 }} />
                </div>
              ))}
            </div>
            {searchMode === "futbology" && !access.isPaid && (
              <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 12, width: "100%", alignItems: "flex-start" }}>
                <div style={{ background: GREEN_BG, width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Lock size={18} color={GREEN} />
                </div>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Importação em massa é só pra assinantes</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.5, maxWidth: 480 }}>
                  Se você já tem um histórico grande de jogos (de outro app, tipo o Futbology), importar tudo de uma vez é um recurso da assinatura. No plano grátis, você pode registrar até {access.gamesLimit} jogos um por um nas outras abas.
                </p>
                <div onClick={() => onNavigate("assinatura")} style={{ background: GREEN, padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", textTransform: "uppercase", margin: 0 }}>Ver planos</p>
                </div>
              </div>
            )}
            {searchMode === "futbology" && access.isPaid && (
              <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                <div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, margin: 0 }}>Importar jogos de um arquivo CSV</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: "4px 0 0", lineHeight: 1.5 }}>
                    Se você tem seus jogos num app tipo o Futbology, exporte como CSV e importe aqui. No formato do Futbology a gente reconhece cada jogo sozinho (times, escudos, estádio, cidade e país) — você só confere.
                  </p>
                </div>
                <div onClick={downloadCsvTemplate} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", width: "fit-content" }}>
                  <Download size={14} color={GREEN} />
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>Baixar modelo de CSV</p>
                </div>
                <div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
                    style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: TEXT }}
                  />
                </div>
                {csvError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{csvError}</p>}
                {csvResolving && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Reconhecendo seus jogos… {csvResolving.done}/{csvResolving.total}</p>
                    <div style={{ background: BG, border: `1px solid ${BORDER}`, height: 8, borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ background: GREEN, height: "100%", width: `${Math.round((csvResolving.done / csvResolving.total) * 100)}%`, borderRadius: 999 }} />
                    </div>
                  </div>
                )}
                {!csvResolving && csvNote && csvRows.length > 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: 0 }}>{csvNote}</p>}
                {csvResult && (
                  <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Resumo final</p>
                    <div style={{ display: "flex", gap: 16, flexDirection: isMobile ? "column" : "row" }}>
                      <div style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Importados</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: TEXT, margin: "4px 0" }}>{csvResult.successCount}</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Jogos adicionados ao seu histórico</p>
                      </div>
                      <div style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                        <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Pulados</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: TEXT, margin: "4px 0" }}>{csvResult.skippedCount}</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Marcados como pular ou com dado faltando</p>
                      </div>
                    </div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Os jogos importados foram adicionados ao seu Football Passport.</p>
                    <div onClick={() => onNavigate("jogos")} style={{ background: GREEN, padding: "14px 24px", borderRadius: 8, textAlign: "center", cursor: "pointer", width: "fit-content" }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", margin: 0 }}>Ver meus jogos</p>
                    </div>
                  </div>
                )}
                {csvRows.length > 0 && (() => {
                  const totalRows = csvRows.length;
                  const batchStart = csvBatchIndex * CSV_BATCH_SIZE;
                  const batchEnd = Math.min(batchStart + CSV_BATCH_SIZE, totalRows);
                  const currentBatch = csvRows.slice(batchStart, batchEnd);
                  const isFirstBatch = csvBatchIndex === 0;
                  const isLastBatch = batchEnd >= totalRows;
                  const progressPct = Math.round((batchEnd / totalRows) * 1000) / 10;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Confirmando {batchStart + 1}–{batchEnd} de {totalRows} jogos</p>
                          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, margin: 0 }}>{progressPct}% ({batchEnd}/{totalRows})</p>
                        </div>
                        <div style={{ background: BG, border: `1px solid ${BORDER}`, height: 8, borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ background: GREEN, height: "100%", width: `${progressPct}%`, borderRadius: 999 }} />
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {currentBatch.map((row) => {
                          const isValid = row.date && row.home && row.away && row.country;
                          return (
                            <div key={row.rowId} style={{ background: BG, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 16, opacity: row.include ? 1 : 0.5 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Data</p>
                                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{row.rawDate || "—"}</p>
                                </div>
                                <div style={{ background: isValid ? BORDER : "#fecaca", borderRadius: 999, padding: "8px 12px" }}>
                                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: isValid ? MUTED : "#dc2626", margin: 0 }}>{row.autoState === "pending" ? "reconhecendo…" : row.autoState === "matched" && isValid ? "reconhecido ✓" : isValid ? "já identificado" : "falta dado"}</p>
                                </div>
                              </div>
                              <div>
                                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Competição</p>
                                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: "2px 0 0" }}>{row.competition || "—"}</p>
                                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: "6px 0 0" }}>{row.home || "?"} {row.homeScore ?? ""}×{row.awayScore ?? ""} {row.away || "?"}</p>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ position: "relative" }}>
                                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Estádio</p>
                                  <input
                                    value={row.stadium}
                                    onChange={(e) => updateCsvRow(row.rowId, "stadium", e.target.value)}
                                    onFocus={() => setCsvActiveField({ rowId: row.rowId, field: "stadium" })}
                                    onBlur={() => setTimeout(() => setCsvActiveField(null), 150)}
                                    placeholder="Comece a digitar pra ver sugestões"
                                    style={{ width: "100%", background: "#fff", border: "none", borderRadius: 8, padding: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: TEXT, marginTop: 4, boxSizing: "border-box" }}
                                  />
                                  {csvActiveField?.rowId === row.rowId && csvActiveField?.field === "stadium" && row.stadium.trim().length >= 3 && (
                                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", maxHeight: 200, overflowY: "auto", zIndex: 30 }}>
                                      {csvSuggestLoading && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Buscando...</p>}
                                      {!csvSuggestLoading && csvSuggestError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", padding: "10px 14px", margin: 0 }}>{csvSuggestError}</p>}
                                      {!csvSuggestLoading && !csvSuggestError && csvSuggestions.length === 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Nenhum resultado — confirma a grafia ou deixa assim mesmo.</p>}
                                      {!csvSuggestLoading && csvSuggestions.map((s) => (
                                        <div
                                          key={s.name}
                                          onMouseDown={() => {
                                            updateCsvRow(row.rowId, "stadium", s.name);
                                            if (s.country) updateCsvRow(row.rowId, "country", s.country);
                                            if (s.city) updateCsvRow(row.rowId, "city", s.city);
                                            setCsvActiveField(null);
                                            setCsvSuggestions([]);
                                          }}
                                          style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                                        >
                                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{s.name}</p>
                                          {(s.city || s.country) && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, color: MUTED, margin: 0 }}>{[s.city, s.country].filter(Boolean).join(", ")}</p>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <div style={{ flex: 1, position: "relative" }}>
                                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Mandante</p>
                                    <input
                                      value={row.home}
                                      onChange={(e) => { updateCsvRow(row.rowId, "home", e.target.value); updateCsvRow(row.rowId, "homeLogo", null); }}
                                      onFocus={() => setCsvActiveField({ rowId: row.rowId, field: "home" })}
                                      onBlur={() => setTimeout(() => setCsvActiveField(null), 150)}
                                      style={{ width: "100%", background: "#fff", border: "none", borderRadius: 8, padding: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: TEXT, marginTop: 4, boxSizing: "border-box" }}
                                    />
                                    {csvActiveField?.rowId === row.rowId && csvActiveField?.field === "home" && row.home.trim().length >= 3 && (
                                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", maxHeight: 200, overflowY: "auto", zIndex: 30 }}>
                                        {csvSuggestLoading && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Buscando...</p>}
                                        {!csvSuggestLoading && csvSuggestError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", padding: "10px 14px", margin: 0 }}>{csvSuggestError}</p>}
                                        {!csvSuggestLoading && !csvSuggestError && csvSuggestions.length === 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Nenhum resultado — confirma a grafia ou deixa assim mesmo.</p>}
                                        {!csvSuggestLoading && csvSuggestions.map((s) => (
                                          <div key={s.name} onMouseDown={() => pickCsvSuggestion(row.rowId, "home", s.name, s.logo)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                                            <TeamBadge name={s.name} url={s.logo} size={20} />
                                            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{s.name}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, position: "relative" }}>
                                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Visitante</p>
                                    <input
                                      value={row.away}
                                      onChange={(e) => { updateCsvRow(row.rowId, "away", e.target.value); updateCsvRow(row.rowId, "awayLogo", null); }}
                                      onFocus={() => setCsvActiveField({ rowId: row.rowId, field: "away" })}
                                      onBlur={() => setTimeout(() => setCsvActiveField(null), 150)}
                                      style={{ width: "100%", background: "#fff", border: "none", borderRadius: 8, padding: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: TEXT, marginTop: 4, boxSizing: "border-box" }}
                                    />
                                    {csvActiveField?.rowId === row.rowId && csvActiveField?.field === "away" && row.away.trim().length >= 3 && (
                                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", maxHeight: 200, overflowY: "auto", zIndex: 30 }}>
                                        {csvSuggestLoading && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Buscando...</p>}
                                        {!csvSuggestLoading && csvSuggestError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", padding: "10px 14px", margin: 0 }}>{csvSuggestError}</p>}
                                        {!csvSuggestLoading && !csvSuggestError && csvSuggestions.length === 0 && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, padding: "10px 14px", margin: 0 }}>Nenhum resultado — confirma a grafia ou deixa assim mesmo.</p>}
                                        {!csvSuggestLoading && csvSuggestions.map((s) => (
                                          <div key={s.name} onMouseDown={() => pickCsvSuggestion(row.rowId, "away", s.name, s.logo)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                                            <TeamBadge name={s.name} url={s.logo} size={20} />
                                            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{s.name}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <input value={row.country} onChange={(e) => updateCsvRow(row.rowId, "country", e.target.value)} placeholder="País (obrigatório)" style={{ flex: 1, background: "#fff", border: `1px solid ${row.country ? BORDER : "#dc2626"}`, borderRadius: 8, padding: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: TEXT, boxSizing: "border-box" }} />
                                  <input value={row.city} onChange={(e) => updateCsvRow(row.rowId, "city", e.target.value)} placeholder="Cidade" style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: TEXT, boxSizing: "border-box" }} />
                                </div>
                              </div>
                              {row.needsManualSplit && row.autoState !== "pending" && (
                                <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: 12 }}>
                                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: "#92400e", textTransform: "uppercase", margin: 0 }}>Não reconhecemos este jogo — texto original do Futbology</p>
                                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#92400e", margin: "6px 0 0", lineHeight: 1.5 }}>{row.combinedText}{row.competition ? ` — ${row.competition}` : ""}</p>
                                </div>
                              )}
                              <div onClick={() => updateCsvRow(row.rowId, "include", !row.include)} style={{ background: "#fff", padding: "10px 16px", borderRadius: 8, textAlign: "center", cursor: "pointer", width: "fit-content" }}>
                                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{row.include ? "Pular este jogo" : "Desmarcar pular"}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
                        <div onClick={isFirstBatch ? undefined : () => setCsvBatchIndex((i) => i - 1)} style={{ background: "#fff", border: `1px solid ${BORDER}`, padding: "14px 24px", borderRadius: 8, textAlign: "center", cursor: isFirstBatch ? "default" : "pointer", opacity: isFirstBatch ? 0.4 : 1 }}>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>← Lote anterior</p>
                        </div>
                        <div onClick={isLastBatch ? undefined : () => setCsvBatchIndex((i) => i + 1)} style={{ background: "#fff", border: `1px solid ${BORDER}`, padding: "14px 24px", borderRadius: 8, textAlign: "center", cursor: isLastBatch ? "default" : "pointer", opacity: isLastBatch ? 0.4 : 1 }}>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>Confirmar e ir pro próximo lote →</p>
                        </div>
                        <div onClick={csvImporting ? undefined : () => handleCsvImport(batchEnd)} style={{ background: GREEN_BUTTON, opacity: csvImporting ? 0.6 : 1, padding: "14px 24px", borderRadius: 8, textAlign: "center", cursor: csvImporting ? "default" : "pointer" }}>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, textTransform: "uppercase", margin: 0 }}>{csvImporting ? "Importando..." : "Importar os confirmados até aqui"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {searchMode !== "futbology" && (
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, width: "100%" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: 14, borderRadius: 12 }}>
                  <Icon name="search" size={18} color={MUTED} />
                  <input
                    value={stadiumQuery}
                    onChange={(e) => setStadiumQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onKeyDown={(e) => e.key === "Enter" && (setShowSuggestions(false), handleSearch())}
                    placeholder={searchMode === "clube" ? "Buscar clube..." : searchMode === "selecao" ? "Buscar seleção (ex: Brasil)..." : "Buscar estádio..."}
                    style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT }}
                  />
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", zIndex: 20, overflow: "hidden" }}>
                    {suggestions.map((s) => (
                      <div
                        key={s.name}
                        onMouseDown={() => pickSuggestion(s.name)}
                        style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                      >
                        {(searchMode === "clube" || searchMode === "selecao") && <TeamBadge name={s.name} url={s.logo} size={22} />}
                        <div>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{s.name}</p>
                          {s.city && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{s.city}{s.country ? `, ${s.country}` : ""}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <select value={seasonValue} onChange={(e) => setSeasonValue(e.target.value)} style={{ ...fieldStyle, width: isMobile ? "100%" : 180 }}>
                <optgroup label="Temporada europeia (jul–jun)">
                  {seasonOptionGroups().eu.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Ano-calendário (jan–dez)">
                  {seasonOptionGroups().cal.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              </select>
              <div onClick={loading ? undefined : () => { setShowSuggestions(false); handleSearch(); }} style={{ background: GREEN_BUTTON, opacity: loading ? 0.6 : 1, padding: "14px 24px", borderRadius: 12, textAlign: "center", cursor: loading ? "default" : "pointer", whiteSpace: "nowrap" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{loading ? "Buscando..." : "Buscar"}</p>
              </div>
            </div>
            )}
            {venue && (
              <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {venue.isClub && <TeamBadge name={venue.name} url={venue.logo} size={40} />}
                  <div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>{venue.name}</p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: "4px 0 0" }}>{venue.city}, {venue.country}{venue.capacity ? ` • Capacidade: ${venue.capacity.toLocaleString("pt-BR")}` : ""}</p>
                  </div>
                </div>
                <div style={{ background: GREEN_BG, display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: 999 }}>
                  <Check size={14} color={GREEN} />
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Selecionado</p>
                </div>
              </div>
            )}
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
          </div>

          {games.length > 0 && (
            <>
              <div style={{ height: 1, background: BORDER, width: "100%" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-end", gap: 12 }}>
                  <div>
                    <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Etapa 2 · Lista de jogos</p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: "6px 0 0" }}>Jogos disponíveis</p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: "4px 0 0" }}>{filteredGames.length} jogo(s) encontrado(s)</p>
                  </div>
                  {distinctCompetitions.length > 1 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: isMobile ? "100%" : 220 }}>
                      <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Competição</p>
                      <select value={competitionFilter} onChange={(e) => setCompetitionFilter(e.target.value)} style={{ ...fieldStyle, padding: "10px 14px" }}>
                        <option value="todas">Todas as competições</option>
                        {distinctCompetitions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredGames.map((g) => {
                    const selected = selectedIds.has(g.apiFixtureId);
                    const isSaving = savingId === g.apiFixtureId;
                    return (
                      <div key={g.apiFixtureId} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>{new Date(g.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "4px 0", flexWrap: "wrap" }}>
                            <TeamBadge name={g.home} url={g.homeLogo} size={24} />
                            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{g.home} {g.homeScore ?? "-"}×{g.awayScore ?? "-"} {g.away}</p>
                            <TeamBadge name={g.away} url={g.awayLogo} size={24} />
                          </div>
                          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{g.competition}</p>
                        </div>
                        <div onClick={() => handleAddGame(g)} style={{ background: selected ? BORDER : GREEN_BUTTON, opacity: isSaving ? 0.6 : 1, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: 10, cursor: selected || isSaving ? "default" : "pointer", flexShrink: 0 }}>
                          {selected && <Check size={14} color={MUTED} />}
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: selected ? MUTED : "#fff", margin: 0 }}>{isSaving ? "Salvando..." : selected ? "Adicionado" : "+ Adicionar"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ height: 1, background: BORDER, width: "100%" }} />
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 16, width: "100%" }}>
                <div>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GREEN, textTransform: "uppercase", margin: 0 }}>Etapa 3 · Concluir</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: "6px 0 0" }}>{selectedIds.size > 0 ? `${selectedIds.size} jogo(s) já adicionados ao seu Football Passport` : "Clique em \"+ Adicionar\" nos jogos que você quer registrar"}</p>
                </div>
                <div onClick={onDone} style={{ background: GREEN_BUTTON, padding: "14px 24px", borderRadius: 12, textAlign: "center", cursor: "pointer", whiteSpace: "nowrap" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>Concluir →</p>
                </div>
              </div>
            </>
          )}

          {showManual && (
            <>
              <div style={{ height: 1, background: BORDER, width: "100%" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: BODY, margin: 0 }}>Não encontramos esse estádio na nossa base. Preencha os dados manualmente — só entram nas suas estatísticas, sem verificação automática.</p>
                <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                  <input value={manual.home} onChange={(e) => setManual((m) => ({ ...m, home: e.target.value }))} placeholder="Time da casa" style={fieldStyle} />
                  <input value={manual.away} onChange={(e) => setManual((m) => ({ ...m, away: e.target.value }))} placeholder="Time visitante" style={fieldStyle} />
                </div>
                <input type="date" value={manual.date} max={new Date().toISOString().split("T")[0]} onChange={(e) => setManual((m) => ({ ...m, date: e.target.value }))} style={fieldStyle} />
                <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                  <input value={manual.stadium} onChange={(e) => setManual((m) => ({ ...m, stadium: e.target.value }))} placeholder="Estádio" style={fieldStyle} />
                  <input value={manual.city} onChange={(e) => setManual((m) => ({ ...m, city: e.target.value }))} placeholder="Cidade" style={fieldStyle} />
                </div>
                <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                  <input value={manual.country} onChange={(e) => setManual((m) => ({ ...m, country: e.target.value }))} placeholder="País" style={fieldStyle} />
                  <input value={manual.competition} onChange={(e) => setManual((m) => ({ ...m, competition: e.target.value }))} placeholder="Competição" style={fieldStyle} />
                </div>
                <div onClick={saving ? undefined : handleManualSave} style={{ background: GREEN_BUTTON, opacity: saving ? 0.6 : 1, padding: "14px 24px", borderRadius: 12, textAlign: "center", cursor: saving ? "default" : "pointer" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", margin: 0 }}>{saving ? "Salvando..." : "Salvar jogo"}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AuthedFooter />
    </div>
  );
}

/* --- Minha Assinatura: gerenciar plano, ver status, cancelar --- */
// Nomes amigáveis pros IDs de bandeira que o Mercado Pago devolve.
const PAYMENT_METHOD_NAMES = {
  visa: "Cartão Visa",
  master: "Cartão Mastercard",
  amex: "Cartão American Express",
  elo: "Cartão Elo",
  hipercard: "Cartão Hipercard",
  diners: "Cartão Diners Club",
  account_money: "Saldo em conta Mercado Pago",
  pix: "Pix",
};

// Só inicializa o SDK do Mercado Pago uma vez, mesmo se o modal abrir e
// fechar várias vezes.
let mpInitialized = false;

/* --- Atualizar Cartão: usa os "Secure Fields" do Mercado Pago — os
   campos de número/validade/CVV rodam isolados no SDK deles, o dado
   bruto do cartão nunca passa pelo nosso código nem pelo nosso servidor,
   só o token gerado. --- */
function AtualizarCartaoModal({ userId, onClose, onSaved }) {
  const [cardholderName, setCardholderName] = useState("");
  const [cpf, setCpf] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mpInitialized && process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) {
      initMercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);
      mpInitialized = true;
    }
  }, []);

  const handleSave = async () => {
    if (!cardholderName.trim()) return setError("Preencha o nome como está no cartão.");
    if (!cpf.trim()) return setError("Preencha o CPF do titular do cartão.");
    setSaving(true);
    setError(null);
    try {
      const token = await createCardToken({
        cardholderName: cardholderName.trim(),
        identificationType: "CPF",
        identificationNumber: cpf.replace(/\D/g, ""),
      });
      const res = await authFetch("/api/subscribe/update-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, cardTokenId: token.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível atualizar o cartão.");
      onSaved();
    } catch (e) {
      setError(e.message || "Não foi possível gerar o token do cartão. Confira os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const fieldBoxStyle = { background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" };
  const labelStyle = { fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: "0 0 6px" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 342, display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ background: "rgba(0,200,83,0.07)", borderRadius: 999, padding: 12 }}>
            <CreditCard size={28} color={GREEN} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center", textAlign: "center" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Atualizar pagamento</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Insira os dados do novo cartão de crédito para faturamento.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <p style={labelStyle}>Número do cartão</p>
            <div style={fieldBoxStyle}>
              <CardNumber placeholder="0000 0000 0000 0000" style={{ base: { fontSize: "14px", fontFamily: "Inter, sans-serif", color: TEXT } }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Validade</p>
              <div style={fieldBoxStyle}>
                <ExpirationDate placeholder="MM/AA" style={{ base: { fontSize: "14px", fontFamily: "Inter, sans-serif", color: TEXT } }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>CVV</p>
              <div style={fieldBoxStyle}>
                <SecurityCode placeholder="123" style={{ base: { fontSize: "14px", fontFamily: "Inter, sans-serif", color: TEXT } }} />
              </div>
            </div>
          </div>
          <div>
            <p style={labelStyle}>Nome no cartão</p>
            <input value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} placeholder="Nome como está no cartão" style={{ ...fieldBoxStyle, width: "100%", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, outline: "none" }} />
          </div>
          <div>
            <p style={labelStyle}>CPF do titular</p>
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" style={{ ...fieldBoxStyle, width: "100%", fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, outline: "none" }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, color: MUTED, margin: "4px 0 0" }}>Exigido pelo Mercado Pago pra gerar o token do cartão com segurança — não fica salvo com a gente.</p>
          </div>
        </div>
        {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 12 }}>
          <div onClick={onClose} style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "12px 20px", textAlign: "center", cursor: "pointer" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Cancelar</p>
          </div>
          <div onClick={saving ? undefined : handleSave} style={{ flex: 1, background: GREEN, opacity: saving ? 0.6 : 1, borderRadius: 999, padding: "12px 20px", textAlign: "center", cursor: saving ? "default" : "pointer" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{saving ? "Salvando..." : "Salvar"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MinhaAssinatura({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const px = isMobile ? "16px" : "80px";
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [access, setAccess] = useState(null);
  const [canceling, setCanceling] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  const load = async () => {
    const acc = await checkPassportAccess();
    setAccess(acc);
    const supabase = supabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    setUserName(userData.user?.user_metadata?.name || userData.user?.email || "");
    setUserAvatar(userData.user?.user_metadata?.avatar_url || null);

    if (acc.userId) {
      try {
        const res = await authFetch(`/api/subscribe/invoices?userId=${acc.userId}`);
        const data = await res.json();
        setInvoices(res.ok ? data.invoices : []);
      } catch {
        setInvoices([]);
      }
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCancel = async () => {
    setCanceling(true);
    setError(null);
    try {
      const res = await authFetch("/api/subscribe/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: access.userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível cancelar.");
      setShowCancelModal(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCanceling(false);
    }
  };

  // Trocar de plano hoje funciona cancelando o antigo e criando um novo —
  // o Mercado Pago não tem uma troca direta de valor/frequência numa
  // assinatura já ativa, então esse é o jeito real de fazer isso.
  const handleSwitchPlan = async (newPlan) => {
    if (!window.confirm(`Trocar para o plano ${newPlan === "annual" ? "anual" : "mensal"}? Sua assinatura atual será cancelada e você será redirecionado para confirmar a nova.`)) return;
    setSwitching(true);
    setError(null);
    try {
      const cancelRes = await authFetch("/api/subscribe/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: access.userId }),
      });
      if (!cancelRes.ok) {
        const d = await cancelRes.json();
        throw new Error(d.error || "Não foi possível cancelar o plano atual.");
      }
      const res = await authFetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: access.userId, email: access.userEmail, plan: newPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível iniciar o novo plano.");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e.message);
      setSwitching(false);
    }
  };

  if (access === null) {
    return (
      <div style={{ background: BG, width: "100%", minHeight: "100vh" }}>
        <AuthedNav active="perfil" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />
        <Loading />
      </div>
    );
  }

  const sub = access.subscription;
  const planLabel = sub?.plan === "annual" ? "Plano Assinante — Anual" : sub?.plan === "monthly" ? "Plano Assinante — Mensal" : null;
  const planPrice = sub?.plan === "annual" ? "R$ 99,90/ano" : "R$ 9,90/mês";
  // Próxima cobrança estimada a partir da data de início — o Mercado Pago
  // não devolve essa data pronta pra gente exibir, então calculamos com
  // base na frequência do plano (mensal = +1 mês, anual = +1 ano).
  const nextBilling = sub?.created_at
    ? (() => {
        const d = new Date(sub.created_at);
        if (sub.plan === "annual") d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      })()
    : null;

  const perks = ["Football Passport completo", "Gamificação e badges", "Níveis de torcedor (5 categorias)", "Histórico completo de jogos", "15% desconto em consultorias", "Alertas personalizados de jogos"];

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="perfil" userName={userName} userAvatar={userAvatar} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16, padding: isMobile ? `32px ${px}` : `48px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <Badge>Configurações de Conta</Badge>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 40, color: TEXT, margin: 0 }}>Minha Assinatura</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 14, color: MUTED, margin: 0 }}>Gerencie seu plano, método de pagamento e histórico de faturas.</p>
      </div>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, padding: isMobile ? `24px ${px} 48px` : `40px ${px} 80px` }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, maxWidth: isMobile ? "100%" : 780 }}>
          {access.legacy ? (
            <div style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: GREEN, margin: 0 }}>Acesso liberado (conta antiga)</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: BODY, margin: 0 }}>Sua conta foi criada antes do lançamento da assinatura do Passport, então você continua com acesso livre, sem precisar pagar nada.</p>
            </div>
          ) : sub?.status === "active" ? (
            <>
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0px 4px 6px rgba(15,23,42,0.05)", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, color: TEXT, margin: 0 }}>Plano Atual</p>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: GREEN }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 28, color: TEXT, margin: 0 }}>{planLabel}</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, color: GREEN, margin: 0 }}>{planPrice}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {nextBilling && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: MUTED, margin: 0 }}>Próxima cobrança: {nextBilling}</p>}
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Renovação automática ativada</p>
                </div>
                {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div onClick={switching || canceling ? undefined : () => handleSwitchPlan(sub.plan === "annual" ? "monthly" : "annual")} style={{ border: `1px solid ${BORDER}`, borderRadius: 999, padding: "10px 20px", cursor: switching ? "default" : "pointer", opacity: switching ? 0.6 : 1 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{switching ? "Processando..." : `Trocar para ${sub.plan === "annual" ? "mensal" : "anual"}`}</p>
                  </div>
                  <p onClick={() => setShowCancelModal(true)} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#ef4444", margin: 0, cursor: "pointer" }}>Cancelar assinatura</p>
                </div>
              </div>

              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0px 4px 6px rgba(15,23,42,0.05)", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, color: TEXT, margin: 0 }}>Método de Pagamento</p>
                {sub?.payment_method_id ? (
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <CreditCard size={32} color={GREEN} />
                    <div>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{PAYMENT_METHOD_NAMES[sub.payment_method_id] || sub.payment_method_id}</p>
                      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>Os últimos dígitos do cartão não ficam disponíveis nessa integração — só a bandeira.</p>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, margin: 0 }}>Ainda não identificamos a forma de pagamento — isso aparece assim que o Mercado Pago confirmar a assinatura.</p>
                )}
                {sub?.status === "active" && (
                  <div onClick={() => setShowCardModal(true)} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 16px", textAlign: "center", cursor: "pointer", width: isMobile ? "100%" : 200 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Atualizar cartão</p>
                  </div>
                )}
              </div>

              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0px 4px 6px rgba(15,23,42,0.05)", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, color: TEXT, margin: 0 }}>Histórico de Faturas</p>
                {invoices === null && <Loading compact />}
                {invoices !== null && invoices.length === 0 && (
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, margin: 0 }}>Nenhuma fatura ainda — a primeira cobrança aparece aqui assim que for processada.</p>
                )}
                {invoices !== null && invoices.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {!isMobile && (
                      <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, paddingBottom: 12 }}>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0, width: 120 }}>Data</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0, flex: 1 }}>Descrição</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0, width: 100 }}>Valor</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: MUTED, textTransform: "uppercase", margin: 0, width: 90, textAlign: "right" }}>Status</p>
                      </div>
                    )}
                    {invoices.map((inv, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, alignItems: isMobile ? "flex-start" : "center", padding: "16px 0", borderBottom: `1px solid ${BORDER}` }}>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, margin: 0, width: isMobile ? "auto" : 120 }}>{new Date(inv.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT, margin: 0, flex: isMobile ? "none" : 1 }}>{inv.plan}</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, margin: 0, width: isMobile ? "auto" : 100 }}>{Number(inv.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                        <div style={{ width: isMobile ? "auto" : 90, display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                          <div style={{ width: 10, height: 10, borderRadius: 5, background: inv.status === "processed" || inv.status === "approved" ? GREEN : inv.status === "scheduled" || inv.status === "pending" ? GOLD : "#ef4444" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <PassportPaywall userId={access.userId} userEmail={access.userEmail} userName={userName} userAvatar={userAvatar} />
          )}
        </div>

        {(access.legacy || sub?.status === "active") && (
          <div style={{ width: isMobile ? "100%" : 420, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0px 4px 6px rgba(15,23,42,0.05)", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT, margin: 0 }}>O que está incluído</p>
              {perks.map((p) => (
                <div key={p} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ background: GREEN_BG, width: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check size={12} color={GREEN} />
                  </div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, margin: 0 }}>{p}</p>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0px 4px 6px rgba(15,23,42,0.05)", borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT, margin: 0 }}>Precisa de ajuda?</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: MUTED, margin: 0 }}>Dúvidas sobre sua assinatura ou problemas com o pagamento?</p>
              <a href="mailto:suporte@tripsz.com.br" style={{ background: GREEN_BUTTON, borderRadius: 999, padding: "12px 20px", textAlign: "center", textDecoration: "none" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", margin: 0 }}>Falar com suporte</p>
              </a>
              <div onClick={() => onNavigate("landing")} style={{ border: `1px solid ${BORDER}`, borderRadius: 999, padding: "12px 20px", textAlign: "center", cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Perguntas frequentes</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <AuthedFooter />

      {showCancelModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 342, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ background: "rgba(239,68,68,0.06)", borderRadius: 999, padding: 12 }}>
                <AlertCircle size={28} color="#ef4444" />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Cancelar assinatura</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, lineHeight: 1.4, color: MUTED, margin: 0 }}>Tem certeza? Você perderá acesso a todos os seus benefícios premium:</p>
            </div>
            <div style={{ background: BG, borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {["Football Passport completo", "Badges e sistema de gamificação", "Níveis de torcedor e categorias", "Registro ilimitado de jogos", "15% de desconto em consultorias", "Histórico completo de partidas"].map((label) => (
                <div key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid #ef4444", borderRadius: 8, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 9, color: "#ef4444", margin: 0 }}>✕</p>
                  </div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 12, color: TEXT, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ background: "rgba(234,179,8,0.13)", borderRadius: 8, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 10, color: "#b48200", margin: 0 }}>i</p>
              </div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 11, lineHeight: 1.3, color: TEXT, margin: 0 }}>Seu plano permanecerá ativo até o final do período vigente.</p>
            </div>
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "100%" }}>
              <div onClick={() => setShowCancelModal(false)} style={{ background: GREEN, borderRadius: 999, padding: "12px 24px", textAlign: "center", cursor: "pointer", width: "100%" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>Manter assinatura</p>
              </div>
              <p onClick={canceling ? undefined : handleCancel} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#ef4444", margin: 0, cursor: canceling ? "default" : "pointer", padding: "8px 0" }}>{canceling ? "Cancelando..." : "Confirmar cancelamento"}</p>
            </div>
          </div>
        </div>
      )}

      {showCardModal && (
        <AtualizarCartaoModal
          userId={access.userId}
          onClose={() => setShowCardModal(false)}
          onSaved={() => {
            setShowCardModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

const COUNTRY_LIST = [
  "Brasil",
  "Alemanha", "Angola", "Argentina", "Austrália", "Áustria",
  "Bélgica", "Bolívia", "Canadá", "Chile", "China", "Colômbia",
  "Coreia do Sul", "Costa Rica", "Croácia", "Cuba", "Dinamarca",
  "Egito", "Equador", "Escócia", "Espanha", "Estados Unidos",
  "França", "Grécia", "Holanda", "Hungria", "Índia", "Inglaterra",
  "Irlanda", "Islândia", "Itália", "Japão", "México", "Marrocos",
  "Moçambique", "Noruega", "Nova Zelândia", "Panamá", "Paraguai",
  "Peru", "Polônia", "Portugal", "Reino Unido", "República Tcheca",
  "Rússia", "Senegal", "Sérvia", "Suécia", "Suíça", "Turquia",
  "Ucrânia", "Uruguai", "Venezuela",
];

function MeuPerfil({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const PREFS = [
    ["derbies", "Derbies Locais & Clássicos Extremos"],
    ["estadios", "Estádios Históricos / Museus"],
    ["grandes", "Ligas Grandes (Premier / Champions)"],
    ["alternativo", "Futebol Alternativo / Ligas Menores"],
  ];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [favoriteTeams, setFavoriteTeams] = useState([]);
  const [teamQuery, setTeamQuery] = useState("");
  const [teamSuggestions, setTeamSuggestions] = useState([]);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [prefs, setPrefs] = useState([]);
  const [original, setOriginal] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [subAccess, setSubAccess] = useState(null);

  const loadProfile = async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      // Sessão expirada — manda pra Landing em vez de travar a tela
      // pra sempre num "Carregando..." que nunca termina.
      setLoading(false);
      onLogout();
      return;
    }
    const loaded = {
      name: user.user_metadata?.name || "",
      email: user.email || "",
      whatsapp: user.user_metadata?.whatsapp || "",
      country: user.user_metadata?.country || "",
      favoriteTeams: user.user_metadata?.favorite_teams || [],
      prefs: user.user_metadata?.preferences || [],
    };
    setName(loaded.name);
    setEmail(loaded.email);
    setWhatsapp(loaded.whatsapp);
    setCountry(loaded.country);
    setFavoriteTeams(loaded.favoriteTeams);
    setPrefs(loaded.prefs);
    setAvatarUrl(user.user_metadata?.avatar_url || null);
    setOriginal(loaded);
    setLoading(false);
    setSubAccess(await checkPassportAccess());
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (teamQuery.trim().length < 3) {
      setTeamSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teams/suggest?q=${encodeURIComponent(teamQuery)}`);
        const data = await res.json();
        setTeamSuggestions(data.suggestions || []);
        setShowTeamDropdown(true);
      } catch {
        setTeamSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [teamQuery]);

  const addFavoriteTeam = (name) => {
    if (!favoriteTeams.includes(name)) setFavoriteTeams((t) => [...t, name]);
    setTeamQuery("");
    setShowTeamDropdown(false);
  };
  const removeFavoriteTeam = (name) => setFavoriteTeams((t) => t.filter((x) => x !== name));

  const togglePref = (id) => setPrefs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;
    setAvatarError(null);

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setAvatarError("Envie um arquivo JPG ou PNG.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setAvatarError("A imagem precisa ter no máximo 1MB.");
      return;
    }

    setAvatarUploading(true);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");

      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // Acrescenta um carimbo de tempo pra forçar o navegador a buscar a
      // imagem nova, já que o caminho do arquivo é sempre o mesmo.
      const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: freshUrl } });
      if (updateError) throw updateError;

      setAvatarUrl(freshUrl);
    } catch (err) {
      setAvatarError(err.message || "Não foi possível enviar a foto.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDiscard = () => {
    if (!original) return;
    setName(original.name);
    setEmail(original.email);
    setWhatsapp(original.whatsapp);
    setCountry(original.country);
    setFavoriteTeams(original.favoriteTeams || []);
    setPrefs(original.prefs);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    if (newPassword || confirmPassword) {
      if (!currentPassword) return setError("Digite sua senha atual para definir uma nova senha.");
      if (newPassword.length < 8) return setError("A nova senha precisa ter no mínimo 8 caracteres.");
      if (newPassword !== confirmPassword) return setError("As senhas não coincidem.");
    }

    setSaving(true);
    try {
      const supabase = supabaseBrowser();

      // Trocar de senha exige confirmar a senha atual primeiro — o Supabase
      // não faz essa checagem sozinho, então reautenticamos antes de aplicar.
      if (newPassword) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({ email: original.email, password: currentPassword });
        if (reauthError) throw new Error("Senha atual incorreta.");
      }

      const updates = { data: { name, whatsapp, country, favorite_teams: favoriteTeams, preferences: prefs } };
      if (email !== original.email) updates.email = email;
      if (newPassword) updates.password = newPassword;

      const { error: updateError } = await supabase.auth.updateUser(updates);
      if (updateError) throw updateError;

      setOriginal({ name, email, whatsapp, country, favoriteTeams, prefs });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = { width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, outline: "none" };
  const px = isMobile ? "16px" : "80px";

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="perfil" userName={name} userAvatar={avatarUrl} onNavigate={onNavigate} onLogout={onLogout} />

      <div style={{ position: "relative", display: "flex", alignItems: "center", padding: isMobile ? `32px ${px}` : `48px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
          <Badge>Configurações de Conta</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 48, color: TEXT, margin: 0 }}>Seu Perfil de Viajante</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, lineHeight: 1.5, color: BODY, margin: 0, maxWidth: 700 }}>Gerencie suas informações cadastrais, canais de contato, preferências de torcedor e segurança de acesso à sua conta Tripsz.</p>
        </div>
      </div>

      {loading ? (
        <Loading text="Carregando seu perfil..." />
      ) : (
        <div style={{ background: BG_ALT, display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 48, padding: isMobile ? `0 ${px} 32px` : `0 ${px} 48px` }}>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 32, flex: 1 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: TEXT, margin: 0 }}>Dados Cadastrais</p>

            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ width: 100, height: 100, borderRadius: 50, border: `2px solid ${GREEN}`, overflow: "hidden", flexShrink: 0 }}>
                <AvatarCircle url={avatarUrl} name={name} size={100} fontSize={32} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ background: GREEN_BUTTON, opacity: avatarUploading ? 0.6 : 1, padding: "8px 16px", borderRadius: 6, cursor: avatarUploading ? "default" : "pointer", display: "inline-block" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", margin: 0 }}>{avatarUploading ? "Enviando..." : "Alterar foto"}</p>
                  <input type="file" accept="image/jpeg,image/png" onChange={handleAvatarChange} disabled={avatarUploading} style={{ display: "none" }} />
                </label>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>JPG ou PNG. Máximo de 1MB</p>
                {avatarError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>{avatarError}</p>}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nome Completo</p>
                <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
              </div>
              <div style={{ display: "flex", gap: 20, flexDirection: isMobile ? "column" : "row" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>E-mail</p>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>WhatsApp</p>
                  <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} style={fieldStyle} />
                </div>
              </div>
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, maxWidth: isMobile ? "100%" : "calc(50% - 10px)" }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>País</p>
                <input
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setShowCountryDropdown(true); }}
                  onFocus={() => setShowCountryDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCountryDropdown(false), 150)}
                  placeholder="Digite ou escolha seu país"
                  style={fieldStyle}
                />
                {showCountryDropdown && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", maxHeight: 220, overflowY: "auto", zIndex: 20 }}>
                    {COUNTRY_LIST.filter((c) => c.toLowerCase().includes(country.toLowerCase())).map((c) => (
                      <div
                        key={c}
                        onMouseDown={() => { setCountry(c); setShowCountryDropdown(false); }}
                        style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                      >
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, margin: 0 }}>{c}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Meus Times Favoritos</p>
              <div style={{ position: "relative" }}>
                <input
                  value={teamQuery}
                  onChange={(e) => setTeamQuery(e.target.value)}
                  onFocus={() => teamSuggestions.length > 0 && setShowTeamDropdown(true)}
                  onBlur={() => setTimeout(() => setShowTeamDropdown(false), 150)}
                  placeholder="Busque um clube ou seleção pra adicionar"
                  style={fieldStyle}
                />
                {showTeamDropdown && teamSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", maxHeight: 220, overflowY: "auto", zIndex: 20 }}>
                    {teamSuggestions.map((s) => (
                      <div
                        key={s.name}
                        onMouseDown={() => addFavoriteTeam(s.name)}
                        style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                      >
                        <TeamBadge name={s.name} url={s.logo} size={22} />
                        <div>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{s.name}</p>
                          {s.country && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{s.country}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {favoriteTeams.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {favoriteTeams.map((team) => (
                    <div key={team} onClick={() => removeFavoriteTeam(team)} style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 999, padding: "6px 12px", display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>{team}</p>
                      <X size={12} color={GREEN} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ height: 1, background: BORDER, width: "100%" }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Segurança</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Senha Atual</p>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Preencha só se for trocar a senha" style={fieldStyle} />
              </div>
              <div style={{ display: "flex", gap: 20, flexDirection: isMobile ? "column" : "row" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nova Senha</p>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" style={fieldStyle} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Confirmar Nova Senha</p>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" style={fieldStyle} />
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: BORDER, width: "100%" }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Preferências de Viagem</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Estilo de Roteiro Favorito</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {PREFS.map(([id, label]) => {
                  const active = prefs.includes(id);
                  return (
                    <div key={id} onClick={() => togglePref(id)} style={{ background: active ? GREEN_BG : BG_ALT, border: active ? `1.5px solid ${GREEN}` : "1.5px solid transparent", padding: "8px 16px", borderRadius: 999, cursor: "pointer" }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: active ? 700 : 400, fontSize: 13, color: active ? GREEN : BODY, margin: 0 }}>{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
            {success && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: GREEN, margin: 0 }}>Alterações salvas com sucesso!</p>}

            {(() => {
              const sameArray = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));
              const hasChanges = !!original && (
                name !== original.name ||
                email !== original.email ||
                whatsapp !== original.whatsapp ||
                country !== original.country ||
                !sameArray(favoriteTeams, original.favoriteTeams) ||
                !sameArray(prefs, original.prefs) ||
                !!currentPassword || !!newPassword || !!confirmPassword
              );
              const canSave = hasChanges && !saving;
              return (
                <div style={{ display: "flex", gap: 16, justifyContent: "flex-end", width: "100%" }}>
                  <div onClick={hasChanges ? handleDiscard : undefined} style={{ background: BG_ALT, padding: "14px 24px", borderRadius: 8, cursor: hasChanges ? "pointer" : "default", opacity: hasChanges ? 1 : 0.5 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: MUTED, margin: 0 }}>Descartar</p>
                  </div>
                  <div onClick={canSave ? handleSave : undefined} style={{ background: GREEN_BUTTON, opacity: canSave ? 1 : 0.5, padding: "14px 28px", borderRadius: 8, cursor: canSave ? "pointer" : "default" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{saving ? "Salvando..." : "Salvar Alterações"}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{ width: isMobile ? "100%" : 380 }}>
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Status da Conta</p>
              <div style={{ background: "#fff9e6", border: "1px solid #b78103", borderRadius: 8, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <AlertTriangle size={20} color="#b78103" />
                <div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#b78103", margin: 0 }}>Membro Tripsz</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#b78103", margin: 0 }}>Conta ativa</p>
                </div>
              </div>
              {subAccess?.subscription?.status === "active" ? (
                <div onClick={() => onNavigate("assinatura")} style={{ display: "flex", flexDirection: "column", gap: 12, cursor: "pointer" }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Minha Assinatura</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: 5, background: GREEN }} />
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{subAccess.subscription.plan === "annual" ? "Plano Assinante - Anual" : "Plano Assinante - Mensal"}</p>
                    </div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: GREEN, margin: 0 }}>{subAccess.subscription.plan === "annual" ? "R$ 99,90/ano" : "R$ 9,90/mês"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>Gerenciar assinatura</p>
                    <Icon name="arrowRight" size={14} color={GREEN} />
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, lineHeight: 1.4, color: MUTED, margin: 0 }}>Desbloqueie roteiros para acumular conquistas e destravar o nível VIP Groundhopper no seu Football Passport.</p>
                  <div onClick={() => onNavigate("assinatura")} style={{ background: BG_ALT, border: `1px solid ${BORDER}`, padding: "12px 16px", borderRadius: 8, textAlign: "center", cursor: "pointer" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Ver Minha Assinatura</p>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      <AuthedFooter />
    </div>
  );
}
/* ============================================================
   10. CHECKOUT (node 95:877)
   ============================================================ */
function Checkout({ answers, selectedOption, onBack, onDone, onHome }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const handleNavItem = (id) => {
    sessionStorage.setItem("tripsz_scroll_target", id);
    onHome();
  };

  // Próximos dias em que a consultoria atende de verdade: segunda,
  // quarta, sexta e sábado — datas reais, não fixas no código, então
  // nunca aparece uma data que já passou.
  const CONSULTORIA_DAYS_OF_WEEK = [1, 3, 5, 6];
  const availableDays = useMemo(() => {
    const days = [];
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (days.length < 6) {
      if (CONSULTORIA_DAYS_OF_WEEK.includes(d.getDay())) {
        days.push({
          date: new Date(d),
          label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
          day: d.getDate(),
        });
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, []);

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedTime, setSelectedTime] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const selectedDay = availableDays[selectedDayIdx];
  const scheduledDateStr = selectedDay.date.toISOString().split("T")[0];

  useEffect(() => {
    (async () => {
      setLoadingSlots(true);
      setSelectedTime(null);
      try {
        const res = await fetch(`/api/consultoria/availability?date=${scheduledDateStr}`);
        const data = await res.json();
        setTimeSlots(data.slots || []);
        const firstAvailable = (data.slots || []).find((s) => s.available);
        if (firstAvailable) setSelectedTime(firstAvailable.time);
      } catch {
        setTimeSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [scheduledDateStr]);

  const handlePayConsultoria = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: answers.userId,
          tripAnswersId: answers.tripAnswersId,
          selectedOption,
          scheduledDate: scheduledDateStr,
          scheduledTime: selectedTime,
        }),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("O servidor não respondeu corretamente. Tente novamente em instantes.");
      }
      if (!res.ok) throw new Error(data.error || "Não foi possível iniciar o pagamento.");
      // Manda o usuário pro checkout de verdade do Mercado Pago
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const isMobile = useIsMobile();

  return (
    <div style={{ background: BG, width: "100%" }}>
      <TopNavPublic onStart={onBack} onHome={onHome} onNavItem={handleNavItem} active="Roteiros" />
      <div style={{ padding: isMobile ? "24px 16px" : 80, display: "flex", flexDirection: "column", gap: isMobile ? 24 : 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Badge>Consultoria Opcional</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 40, color: TEXT, margin: 0 }}>Contrate a consultoria humana</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, color: BODY, margin: 0 }}>Pague R$ 149,90 e receba ajuda humana para hotéis, reservas, ingressos e ajustes finais da viagem.</p>
        </div>

        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 40 }}>
          <div style={{ flex: 1, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>O que a consultoria inclui</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 14 }}>
              {["Ajuda para escolher hotéis próximos aos estádios", "Sugestões de reservas e transferências", "Ajustes finais do roteiro com base nas suas preferências"].map((l) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, color: BODY, margin: 0 }}>{l}</p>
                  <p style={{ fontFamily: FONT_MONO, color: TEXT, margin: 0 }}>Incluso</p>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Valor único</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: GREEN, margin: 0 }}>R$ 149,90</p>
            </div>

            <div style={{ background: BG_ALT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Shield size={16} color={TEXT} />
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Consultoria humana</p>
                </div>
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: BODY, margin: 0 }}>Uma sessão com especialista para organizar hospedagem, reservas, ingressos e ajustes finais do roteiro.</p>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: GREEN, margin: 0 }}>Valor total da consultoria</p>
            </div>

            <div style={{ background: BG_ALT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? 14 : 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>Agendamento da consultoria</p>
                <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: BODY, margin: "4px 0 0" }}>Escolha uma data disponível e o horário para a conversa com o especialista.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Data disponível</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {availableDays.map((d, i) => {
                    const active = i === selectedDayIdx;
                    return (
                      <div key={i} onClick={() => setSelectedDayIdx(i)} style={{ background: active ? GREEN_BUTTON2 : "#fff", border: `1px solid ${active ? GREEN_BUTTON2 : BORDER}`, borderRadius: 10, padding: isMobile ? 8 : 12, width: isMobile ? "calc(25% - 9px)" : 96, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: active ? "#fff" : MUTED, margin: 0, textTransform: "capitalize" }}>{d.label}</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: active ? "#fff" : TEXT, margin: 0 }}>{d.day}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Horários disponíveis</p>
                {loadingSlots ? (
                  <Loading text="Carregando horários..." compact />
                ) : timeSlots.length === 0 ? (
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, margin: 0 }}>Sem atendimento nesse dia — escolha outra data.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {timeSlots.map((s) => {
                      const active = s.time === selectedTime;
                      return (
                        <div
                          key={s.time}
                          onClick={() => s.available && setSelectedTime(s.time)}
                          style={{ background: active ? GREEN_BUTTON2 : "#fff", border: `1px solid ${active ? GREEN_BUTTON2 : BORDER}`, borderRadius: 8, padding: "10px 14px", cursor: s.available ? "pointer" : "default", opacity: s.available ? 1 : 0.4 }}
                        >
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: active ? "#fff" : TEXT, margin: 0, textDecoration: s.available ? "none" : "line-through" }}>{s.time}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedTime && (
                <div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>{selectedDay.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} · {selectedTime}</p>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: BODY, margin: "4px 0 0" }}>Sessão de 30 minutos via vídeo. Você receberá o link de acesso após a confirmação do pagamento.</p>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: BORDER }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Total Final</p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: GREEN, margin: 0 }}>R$ 149,90</p>
            </div>
            <div style={{ background: BG_ALT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Info size={16} color={MUTED} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.5, color: BODY, margin: 0 }}>Este pagamento contrata a consultoria humana. Após a confirmação, você receberá um link para acessar a agenda e confirmar a data e o horário da sessão.</p>
            </div>
          </div>

          <div style={{ width: isMobile ? "100%" : 480, flexShrink: 0, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 24 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Resumo do Pedido</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, margin: 0 }}>Consultoria humana - tripsz</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>R$ 149,90</p>
              </div>
              <div style={{ height: 1, background: BORDER, width: "100%" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Formas de pagamento</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ background: BG, border: `1px solid ${BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: 999 }}>
                    <CreditCard size={14} color={TEXT} />
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Cartão de crédito</p>
                  </div>
                  <div style={{ background: BG, border: `1px solid ${BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: 999 }}>
                    <QrCode size={14} color={TEXT} />
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Pix</p>
                  </div>
                  <div style={{ background: BG, border: `1px solid ${BORDER}`, display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: 999 }}>
                    <Receipt size={14} color={TEXT} />
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Boleto</p>
                  </div>
                </div>
              </div>
              <div style={{ background: BG_ALT, display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 12, width: "100%" }}>
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="arrowRight" size={16} color={TEXT} />
                </div>
                <p style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.5, color: BODY, margin: 0 }}>Você será redirecionado ao ambiente seguro do Mercado Pago para concluir o pagamento com Pix, cartão ou boleto.</p>
              </div>
            </div>
            <div style={{ background: BG_ALT, borderRadius: 12, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <Lock size={16} color={MUTED} />
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>Pagamento processado com segurança pelo Mercado Pago</p>
            </div>
            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
            <div onClick={loading || !selectedTime ? undefined : handlePayConsultoria} style={{ background: GREEN, opacity: loading || !selectedTime ? 0.5 : 1, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "16px 24px", borderRadius: 8, cursor: loading || !selectedTime ? "default" : "pointer" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: "#fff", textTransform: "uppercase", margin: 0 }}>{loading ? "Redirecionando..." : "Confirmar e ir para o Mercado Pago"}</p>
              {!loading && <Icon name="arrowRight" size={16} color="#fff" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   10. RESULTADO DESBLOQUEADO (node 95:982)
   ============================================================ */

/* ============================================================
   APP SHELL
   ============================================================ */
// Cada passo da jornada tem seu próprio endereço na barra do navegador —
// isso faz o botão voltar/avançar do navegador funcionar de verdade, e
// deixa visível em que momento da jornada a pessoa está.
const SCREEN_TO_PATH = {
  landing: "/",
  criarconta: "/criar-conta",
  assinar: "/assinar",
  account: "/comecar",
  destino: "/roteiro/destino",
  times: "/roteiro/times",
  datas: "/roteiro/datas",
  pessoas: "/roteiro/pessoas",
  preferencias: "/roteiro/preferencias",
  loading: "/roteiro/calculando",
  resultado: "/roteiro/resultado",
  checkout: "/checkout",
  roteiros: "/conta/roteiros",
  roteiro: "/conta/roteiros/detalhe",
  jogos: "/conta/jogos",
  buscar: "/conta/buscar-jogos",
  calendario: "/conta/calendario",
  "registrar-jogo": "/conta/jogos/registrar",
  nivel: "/conta/nivel",
  conquistas: "/conta/conquistas",
  perfil: "/conta/perfil",
  assinatura: "/conta/assinatura",
  ranking: "/conta/ranking",
};
const PATH_TO_SCREEN = Object.fromEntries(Object.entries(SCREEN_TO_PATH).map(([k, v]) => [v, k]));

export default function App() {
  // Remove a tela de carregamento estática (do layout.js) assim que o
  // app de verdade termina de montar — é o sinal de que já passamos do
  // momento "tela branca" que a demora de ~7s deixava aparecer.
  useEffect(() => {
    const el = document.getElementById("app-shell-loader");
    if (el) el.remove();
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
  // Opções A / B / C montadas a partir dos jogos do plano (vale também pra roteiros já salvos).
  const options = useMemo(() => buildOptions(plan), [plan]);
  // A opção escolhida libera a contratação da consultoria.
  const [chosenOption, setChosenOption] = useState(null);
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
    const isInstalledApp = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    if (isInstalledApp && (pathScreen || restoredScreen || "landing") === "landing") {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session) setScreen((current) => (current === "landing" ? "roteiros" : current));
      });
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
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
      budget: answers.budget,
      priority: answers.priority,
      pace: answers.pace,
      favorite_teams: answers.favoriteTeams || [],
    };
    const withPlan = newPlan ? { ...row, plan: slimPlan(newPlan), plan_generated_at: new Date().toISOString() } : row;
    let { data, error } = await supabase.from("trip_answers").insert(withPlan).select().single();
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

  // A pessoa escolheu a opção A, B ou C. Guarda no roteiro: é isso que libera a consultoria
  // (o servidor confere de novo em /api/checkout antes de gerar o pagamento).
  const handleChooseOption = async (key) => {
    setChosenOption(key);
    if (!answers.tripAnswersId) return;
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.from("trip_answers").update({ selected_option: key, selected_option_at: new Date().toISOString() }).eq("id", answers.tripAnswersId);
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

  return (
    <div style={{ width: "100%", minHeight: "100vh" }}>
      <FontImports />
      {screen === "landing" && (
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
      {screen === "resultado" && <ResultadoRoteiro trip={trip} options={options} chosenOption={chosenOption} onChooseOption={handleChooseOption} planLoading={planLoading} planError={planError} onRetryPlan={() => loadPlan()} onHireConsultoria={() => { if (chosenOption) setScreen("checkout"); }} onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "checkout" && <Checkout answers={answers} selectedOption={chosenOption} onBack={() => setScreen("resultado")} onDone={() => setScreen("roteiro")} onHome={restart} />}
      {screen === "roteiro" && (
        <RoteiroDetalhe
          trip={trip}
          options={options}
          chosenOption={chosenOption}
          onChooseOption={handleChooseOption}
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
      {screen === "jogos" && (
        <MeusJogosHistorico
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onRegisterNew={() => setScreen("registrar-jogo")}
        />
      )}
      {screen === "buscar" && <BuscarJogos onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "calendario" && <MeuCalendario onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "registrar-jogo" && (
        <RegistrarJogo
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onDone={() => setScreen("jogos")}
        />
      )}
      {screen === "nivel" && (
        <MeuNivel
          onNavigate={(key) => setScreen(key)}
          onLogout={handleLogout}
          onCreateNew={() => { setAnswers((a) => ({ userId: a.userId })); setPlan(null); setPlanError(null); setChosenOption(null); setStepOffset(1); setScreen("destino"); }}
        />
      )}
      {screen === "perfil" && <MeuPerfil onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "assinatura" && <MinhaAssinatura onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {screen === "ranking" && <RankingTorcedores onNavigate={(key) => setScreen(key)} onLogout={handleLogout} />}
      {showGlobalLoginModal && (
        <LoginModal
          onClose={() => setShowGlobalLoginModal(false)}
          onCreateAccount={() => { setShowGlobalLoginModal(false); setScreen("criarconta"); }}
        />
      )}
    </div>
  );
}
