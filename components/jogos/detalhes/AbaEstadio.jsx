"use client";
import { CheckCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { getVenuePhoto, peekVenuePhoto } from "../../../lib/venuePhoto";
import { flagEmoji, formatInt, formatShortDate } from "../../../lib/gameDetailsCore";
import { teamLabel } from "../../../lib/textUtils";
import { BG_ALT, BODY, BORDER, FONT_DISPLAY, FONT_MONO, GREEN_DARK, GREEN_SOFT, MUTED, TEXT } from "../../../lib/tokens";
import { Icon } from "../../ui/Icon";
import { SectionTitle } from "./ui";

// Esqueleto com brilho animado, enquanto a foto é buscada/baixada.
function PhotoSkeleton({ height, overlay }) {
  return (
    <div aria-hidden="true" style={{ ...(overlay ? { position: "absolute", inset: 0 } : { height, borderRadius: 12, width: "100%" }), background: `linear-gradient(90deg, ${BG_ALT} 0%, #e8edf3 50%, ${BG_ALT} 100%)`, backgroundSize: "200% 100%", animation: "tripszShimmer 1.3s ease-in-out infinite" }}>
      <style>{"@keyframes tripszShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}"}</style>
    </div>
  );
}

// Foto e capacidade vindas da Wikipedia/Wikidata (buscadas ao abrir o modal; ver lib/venuePhoto.js).
function useWikiVenue(venueName, venueCity) {
  const seen = venueName ? peekVenuePhoto(venueName, venueCity) : { done: true, value: null };
  const [state, setState] = useState({ done: seen.done, value: seen.value });
  useEffect(() => {
    if (!venueName) {
      setState({ done: true, value: null });
      return;
    }
    const peek = peekVenuePhoto(venueName, venueCity);
    if (peek.done) {
      setState({ done: true, value: peek.value });
      return;
    }
    let alive = true;
    setState({ done: false, value: null });
    getVenuePhoto(venueName, venueCity).then((val) => {
      if (alive) setState({ done: true, value: val });
    });
    return () => {
      alive = false;
    };
  }, [venueName, venueCity]);
  return state;
}

function StadiumPhoto({ venue, wikiState, isMobile }) {
  // Foto real da Wikipedia primeiro; se não houver, a imagem do cadastro de estádios; sem nenhuma: sem imagem.
  const [wikiFailed, setWikiFailed] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const height = isMobile ? 230 : 262;
  const wikiUrl = wikiState.value && wikiState.value.url && !wikiFailed ? wikiState.value.url : null;
  const apiUrl = venue && venue.image && !apiFailed ? venue.image : null;
  const realImage = wikiUrl || (wikiState.done ? apiUrl : null);

  useEffect(() => {
    setLoaded(false);
  }, [realImage]);

  if (!wikiState.done && !realImage) return <PhotoSkeleton height={height} />;
  if (!realImage) return null; // sem foto: nada de imagem ilustrativa
  return (
    <div style={{ position: "relative", height, borderRadius: 12, overflow: "hidden", background: BG_ALT, width: "100%" }}>
      {!loaded && <PhotoSkeleton height="100%" overlay />}
      <img
        key={realImage}
        src={realImage}
        alt={`Foto do ${(venue && venue.name) || "estádio"}`}
        ref={(el) => {
          if (el && el.complete && el.naturalWidth > 0) setLoaded(true); // já veio do cache do navegador
        }}
        onLoad={() => setLoaded(true)}
        onError={() => (wikiUrl ? setWikiFailed(true) : setApiFailed(true))}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {wikiUrl && loaded && (
        <div style={{ position: "absolute", left: 12, bottom: 12, background: "rgba(15,23,42,0.8)", borderRadius: 4, padding: "4px 8px" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, lineHeight: 1.4, color: "#fff", margin: 0 }}>Foto: Wikipedia</p>
        </div>
      )}
    </div>
  );
}

/**
 * Aba Estádio: nome, foto, capacidade, cidade e país, e o histórico da pessoa
 * nesse estádio. Funciona também em jogo registrado à mão (só sem a capacidade,
 * se o estádio não estiver no cadastro).
 */
export function AbaEstadio({ game, venue, visits, isFirstVisit, isMobile, editLocalSlot }) {
  const name = (venue && venue.name) || game.stadium || "Estádio não informado";
  const city = (venue && venue.city) || game.city || null;
  const country = (venue && venue.country) || game.country || null;
  const place = [city, country].filter(Boolean).join(", ");
  const flag = venue && venue.cc ? flagEmoji(venue.cc) : "";
  const wikiState = useWikiVenue(name !== "Estádio não informado" ? name : null, city);
  const capacity = (venue && venue.capacity) || (wikiState.value && wikiState.value.capacity) || null;
  const first = visits.first ? formatShortDate(visits.first) : "";

  const capacityBlock = (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Users size={22} color={BODY} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, lineHeight: 1.4, color: capacity ? TEXT : MUTED, margin: 0 }}>{capacity ? `${formatInt(capacity)} lugares` : "Capacidade não informada"}</p>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, lineHeight: 1.4, color: MUTED, margin: 0 }}>Capacidade total</p>
      </div>
    </div>
  );
  const placeRow = place && (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <Icon name="mapPin" size={16} color={MUTED} />
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.4, color: MUTED, margin: 0 }}>{place}</p>
      </div>
      {flag && <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>{flag}</span>}
    </div>
  );
  const visitsCard = visits.count > 0 && (
    <div style={{ background: GREEN_SOFT, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10, width: isMobile ? "100%" : 352, flexShrink: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <CheckCheck size={18} color={GREEN_DARK} />
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: GREEN_DARK, margin: 0 }}>Você já esteve aqui {visits.count} {visits.count === 1 ? "vez" : "vezes"}</p>
      </div>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, lineHeight: 1.5, color: BODY, margin: 0 }}>
        {isFirstVisit ? "Contagem atual. Este jogo foi sua primeira visita: o bônus de estádio novo foi ganho naquela data." : `Contagem atual. Sua primeira visita foi em ${first}: o bônus de estádio novo já tinha sido ganho naquela data.`}
      </p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      <SectionTitle title={name} subtitle={`Onde você acompanhou ${teamLabel(game.home_team)} × ${teamLabel(game.away_team)}.`} />
      <StadiumPhoto venue={venue} wikiState={wikiState} isMobile={isMobile} />
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {capacityBlock}
            {placeRow}
          </div>
          {visitsCard}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {capacityBlock}
            {placeRow}
          </div>
          {visitsCard}
        </div>
      )}
      {editLocalSlot && <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>{editLocalSlot}</div>}
      {visits.count > 0 && first && (
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, lineHeight: 1.4, color: MUTED, margin: 0, textTransform: "uppercase" }}>No seu passaporte desde {first}</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.4, color: BODY, margin: 0 }}>{visits.count === 1 ? "Um novo estádio. Mais uma história para contar." : "Um estádio que você já conhece. Mais uma história para contar."}</p>
        </div>
      )}
    </div>
  );
}
