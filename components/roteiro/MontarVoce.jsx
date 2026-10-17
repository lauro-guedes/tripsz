"use client";
/**
 * Opção A — "Monte do seu jeito". A pessoa vê todos os jogos possíveis, dia a dia, e marca os que quer; o dia a dia
 * da viagem é montado na hora com os jogos marcados. Ao escolher, os jogos ficam salvos no plano (plan.custom.games,
 * ver handleChooseOption em TripszApp.jsx) e a opção vira a base da consultoria, como a B.
 */
import { useEffect, useMemo, useState } from "react";
import { WIZARD_COUNTRIES } from "../../lib/calendarCore";
import { haversineKm } from "../../lib/citiesCore";
import { teamLabel } from "../../lib/textUtils";
import { BG, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GOLD, GOLD_BG, GOLD_BORDER, GREEN, GREEN_BG, MUTED, TEXT } from "../../lib/tokens";
import { buildDayPlan, formatDateLabel } from "../../lib/tripOptions";
import { requiredGap } from "../../lib/tripPlanner";
import TeamBadge from "../TeamBadge";

const ACCENT = "#1E3A5F"; // azul-marinho: a identidade da opção A
const DAY_MS = 86400000;
const dayNum = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, dd) / DAY_MS);
};
const byTime = (a, b) => (a.matchDate + (a.kickoff || "")).localeCompare(b.matchDate + (b.kickoff || ""));
const cityOf = (g) => g.venue?.city || g.venue?.name || "";
const title = (g) => `${teamLabel(g.home?.name || "")} x ${teamLabel(g.away?.name || "")}`;
const weekdayLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase();

/** Por que `g` não cabe junto dos jogos já marcados? (devolve o texto, ou null se cabe) */
function conflictReason(g, picked) {
  for (const s of picked) {
    const [a, b] = byTime(s, g) <= 0 ? [s, g] : [g, s];
    const need = requiredGap(a, b, 0); // só o deslocamento: o ritmo é escolha da pessoa
    const gap = Math.abs(dayNum(g.matchDate) - dayNum(s.matchDate));
    if (gap < need) {
      const km = Math.round(haversineKm(a.lat, a.lon, b.lat, b.lon));
      return gap === 0 ? `Mesmo dia de ${title(s)}` : `Precisa de ${need} ${need === 1 ? "dia" : "dias"} desde ${cityOf(s)} (${Number.isFinite(km) ? `${km} km` : "distância"})`;
    }
  }
  return null;
}

/** O roteiro, em ordem de data, volta a um país que já deixou? (devolve o país, ou null) */
function backtrackCountry(sorted) {
  const left = new Set();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].country !== sorted[i].country) left.add(sorted[i - 1].country);
    if (left.has(sorted[i].country)) return sorted[i].country;
  }
  return null;
}

function LeaguePill({ children }) {
  return <span style={{ background: "#1E3A5F", borderRadius: 4, padding: "3px 8px", display: "inline-flex", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: "#fff", whiteSpace: "nowrap" }}>{children}</span>;
}

/** Bandeira do país (imagem, porque o emoji de bandeira não aparece no Windows). Some sozinha se não carregar. */
function Flag({ label }) {
  const iso = WIZARD_COUNTRIES[label] && WIZARD_COUNTRIES[label].iso;
  if (!iso) return null;
  const code = iso === "GB" ? "gb-eng" : iso.toLowerCase();
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://flagcdn.com/w40/${code}.png`} alt="" width={20} height={14} onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ borderRadius: 2, objectFit: "cover", flexShrink: 0 }} />;
}

function Chip({ children, active, onClick, flag, count, small }) {
  return (
    <div role="button" aria-pressed={!!active} onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: small ? "5px 10px" : "7px 12px", borderRadius: 10, cursor: "pointer", background: active ? ACCENT : "#fff", border: `1px solid ${active ? ACCENT : BORDER}` }}>
      {flag ? <Flag label={flag} /> : null}
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: small ? 11 : 12, color: active ? "#fff" : TEXT, margin: 0, whiteSpace: "nowrap" }}>{children}</p>
      {count != null && <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: active ? "rgba(255,255,255,0.75)" : MUTED, margin: 0 }}>{count}</p>}
    </div>
  );
}

function FilterLabel({ children }) {
  return <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: MUTED, textTransform: "uppercase", margin: 0 }}>{children}</p>;
}

export function MontarVoce({ trip, suggested, saved, chosen, onConfirm, onLoadAll, isMobile }) {
  // Plano salvo não traz todos os jogos possíveis: pede o resto uma vez (os já marcados nunca somem da lista).
  const [loadingAll, setLoadingAll] = useState(!!trip.gamesPossibleLimited && !!onLoadAll);
  useEffect(() => {
    if (!trip.gamesPossibleLimited || !onLoadAll) return;
    let alive = true;
    Promise.resolve(onLoadAll()).finally(() => alive && setLoadingAll(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const all = useMemo(() => {
    const byId = new Map();
    for (const g of [...(trip.gamesPossible || []), ...((saved && saved.games) || [])]) byId.set(g.id, g);
    return [...byId.values()].filter((g) => g.matchDate && g.lat != null && g.lon != null).sort(byTime);
  }, [trip.gamesPossible, saved]);
  const countries = useMemo(() => [...new Set(all.map((g) => g.country).filter(Boolean))], [all]);
  const [picked, setPicked] = useState(() => new Set((saved && saved.custom && saved.gameIds) || []));
  const [country, setCountry] = useState("");
  const [leagueSel, setLeagueSel] = useState(() => new Set());
  const [onlyFav, setOnlyFav] = useState(false);

  const pickedGames = all.filter((g) => picked.has(g.id));
  const blocked = (g) => (picked.has(g.id) ? null : conflictReason(g, pickedGames));
  const inCountry = all.filter((g) => !country || g.country === country);
  // ligas do país escolhido (ou do único país), da que tem mais jogos pra que tem menos
  const leagueList = useMemo(() => {
    const count = new Map();
    for (const g of inCountry) if (g.competition?.name) count.set(g.competition.name, (count.get(g.competition.name) || 0) + 1);
    return [...count.entries()].sort((x, y) => y[1] - x[1]);
  }, [inCountry]);
  const showLeagues = (country || countries.length === 1) && leagueList.length > 1;
  const pickCountry = (c) => { setCountry(country === c ? "" : c); setLeagueSel(new Set()); };
  const toggleLeague = (name) => setLeagueSel((prev) => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const shown = inCountry.filter((g) => (leagueSel.size === 0 || leagueSel.has(g.competition?.name) || picked.has(g.id)) && (!onlyFav || g.favorite || g.rivalry || picked.has(g.id)));
  const hasFav = all.some((g) => g.favorite || g.rivalry);

  const toggle = (g) => {
    if (blocked(g)) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(g.id)) next.delete(g.id);
      else next.add(g.id);
      return next;
    });
  };
  const useSuggested = () => suggested && setPicked(new Set(suggested.gameIds.filter((id) => all.some((g) => g.id === id))));
  const savedIds = (saved && saved.custom && saved.gameIds) || [];
  const unchanged = savedIds.length === picked.size && savedIds.every((id) => picked.has(id));
  const confirmed = chosen && unchanged && picked.size > 0;

  // dia a dia do que foi marcado
  const items = pickedGames.length > 0 ? buildDayPlan(pickedGames) : [];
  const cities = [...new Set(pickedGames.map(cityOf))].filter(Boolean);
  const days = items.length ? dayNum(items[items.length - 1].date) - dayNum(items[0].date) + 1 : 0;
  const back = backtrackCountry(pickedGames);

  // jogos agrupados por dia
  const groups = [];
  for (const g of shown) {
    const last = groups[groups.length - 1];
    if (last && last.date === g.matchDate) last.games.push(g);
    else groups.push({ date: g.matchDate, games: [g] });
  }

  const pad = isMobile ? 16 : 24;
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ background: ACCENT, padding: isMobile ? "14px 16px" : "16px 24px", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 8 : 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: ACCENT, margin: 0 }}>A</p>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 15 : 16, color: "#fff", margin: 0 }}>Opção A — Monte do seu jeito</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: "rgba(255,255,255,0.85)", margin: 0 }}>
              {pickedGames.length === 0 ? "Marque os jogos que quer ver" : `${days} ${days === 1 ? "dia" : "dias"} · ${pickedGames.length} ${pickedGames.length === 1 ? "jogo" : "jogos"} · ${cities.join(" + ")}`}
            </p>
          </div>
        </div>
        <span style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 999, padding: "3px 12px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap" }}>Do seu jeito</span>
      </div>

      <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, margin: 0 }}>
          Toque nos jogos que quer ver. Os que não cabem com os já marcados ficam bloqueados.{loadingAll ? " Carregando todos os jogos…" : ""}
        </p>

        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? 12 : 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {countries.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <FilterLabel>País</FilterLabel>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Chip active={!country} onClick={() => { setCountry(""); setLeagueSel(new Set()); }}>Todos</Chip>
                {countries.map((c) => (
                  <Chip key={c} flag={c} active={country === c} count={all.filter((g) => g.country === c).length} onClick={() => pickCountry(c)}>{c}</Chip>
                ))}
              </div>
            </div>
          )}
          {showLeagues && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <FilterLabel>Liga{leagueSel.size > 0 ? ` · ${leagueSel.size} ${leagueSel.size === 1 ? "selecionada" : "selecionadas"}` : ""}</FilterLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {leagueList.map(([name, n]) => (
                  <Chip key={name} small active={leagueSel.has(name)} count={n} onClick={() => toggleLeague(name)}>{name}</Chip>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {hasFav && <Chip small active={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>★ Favoritos e clássicos</Chip>}
              {suggested && <Chip small onClick={useSuggested}>Partir do sugerido</Chip>}
              {picked.size > 0 && <Chip small onClick={() => setPicked(new Set())}>Limpar marcados</Chip>}
            </div>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED, margin: 0 }}>{shown.length} de {all.length} jogos</p>
          </div>
        </div>

        {back && (
          <div style={{ background: GOLD_BG, border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
            <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: GOLD, margin: 0 }}>Esse roteiro volta para {back}. Dá para fazer, mas encarece e cansa; veja se não prefere agrupar por país.</p>
          </div>
        )}

        {all.length === 0 && <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: MUTED, margin: 0 }}>Sem jogos possíveis para escolher neste roteiro.</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((grp) => (
            <div key={grp.date} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, margin: 0 }}>{weekdayLabel(grp.date)}</p>
              {grp.games.map((g) => {
                const on = picked.has(g.id);
                const reason = blocked(g);
                return (
                  <div key={g.id} role="checkbox" aria-checked={on} aria-disabled={!!reason} onClick={() => toggle(g)} style={{ display: "flex", gap: 12, alignItems: "center", padding: isMobile ? 12 : "12px 16px", borderRadius: 10, cursor: reason ? "not-allowed" : "pointer", opacity: reason ? 0.5 : 1, background: on ? GREEN_BG : "#fff", border: `1.5px solid ${on ? GREEN : BORDER}` }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: on ? GREEN : "#fff", border: `1.5px solid ${on ? GREEN : BORDER}` }}>
                      {on && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ display: "flex", flexShrink: 0 }}>
                      <TeamBadge name={g.home?.name} url={g.home?.logo} size={isMobile ? 24 : 28} resolve />
                      <div style={{ marginLeft: -6 }}>
                        <TeamBadge name={g.away?.name} url={g.away?.logo} size={isMobile ? 24 : 28} resolve />
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{title(g)}</p>
                      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, margin: "2px 0 0" }}>
                        {[g.venue?.name, cityOf(g) !== g.venue?.name ? cityOf(g) : null, g.country].filter(Boolean).join(" · ")}
                        {g.approxLocation ? " · local provável" : ""}
                      </p>
                      {reason && <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: GOLD, margin: "4px 0 0" }}>{reason}</p>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                      {g.competition?.name && <LeaguePill>{g.competition.name.length > 18 ? g.competition.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 4).toUpperCase() : g.competition.name}</LeaguePill>}
                      {(g.rivalry || g.favorite) && <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, color: GOLD, margin: 0 }}>{g.rivalry || "Favorito"}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16, display: "flex", flexDirection: "column" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, margin: "0 0 8px" }}>Seu roteiro, dia a dia</p>
            {items.map((it, i) => {
              const isGame = it.type === "game";
              return (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: i === items.length - 1 ? "none" : `1px solid ${BORDER}` }}>
                  <span style={{ minWidth: 48, textAlign: "center", borderRadius: 4, padding: "3px 6px", background: isGame ? GREEN_BG : BG, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: isGame ? GREEN : MUTED, flexShrink: 0 }}>{it.day}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{it.title}</p>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 12, lineHeight: 1.4, color: MUTED, margin: "2px 0 0" }}>{it.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div
          onClick={confirmed || picked.size === 0 ? undefined : () => onConfirm(pickedGames)}
          style={{ background: confirmed ? "#fff" : picked.size === 0 ? BG : ACCENT, border: `1.5px solid ${confirmed ? GREEN : picked.size === 0 ? BORDER : ACCENT}`, borderRadius: 8, padding: "13px 24px", textAlign: "center", cursor: confirmed || picked.size === 0 ? "default" : "pointer" }}
        >
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: confirmed ? GREEN : picked.size === 0 ? MUTED : "#fff", textTransform: "uppercase", margin: 0 }}>
            {confirmed ? "✓ Opção A escolhida" : picked.size === 0 ? "Marque ao menos um jogo" : saved && saved.custom ? "Atualizar opção A" : "Escolher opção A"}
          </p>
        </div>
      </div>
    </div>
  );
}
