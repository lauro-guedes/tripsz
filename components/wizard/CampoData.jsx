"use client";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { WEEKDAYS_PT, addMonths, inBetween, initialMonth, isDisabled, longDate, monthCells, monthIndex, monthOf, monthTitle, shortDate } from "../../lib/calendarGrid";
import { todayInSaoPaulo } from "../../lib/calendarUtils";
import { BORDER, FONT_BODY, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";

const SLATE = "#cbd5e1";
const TINT = "rgba(0,200,83,0.16)"; // dia da ida e dias entre a ida e a volta

/**
 * Campo de data com calendário PRÓPRIO (em vez do nativo, que só abre no mês certo se o campo já tiver valor).
 *  - Vazio, mostra o rótulo ("Data de Volta"); nunca é preenchido sozinho.
 *  - `anchor`: data de referência (a ida, no campo da volta): o calendário abre no mês dela e ela fica marcada.
 *  - Dias fora de [min, max] ficam bloqueados.
 */
export function CampoData({ label, value, min, max, anchor, onChange, isMobile }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: 1970, m0: 0 });
  const today = todayInSaoPaulo();
  const minMonth = monthOf(min || today);
  const maxMonth = monthOf(max);

  const openCalendar = () => {
    setView(initialMonth({ value, anchor, min, max, today }));
    setOpen(true);
  };
  const close = () => setOpen(false);
  const pick = (iso) => {
    if (isDisabled(iso, min, max)) return;
    onChange(iso);
    close();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const canPrev = !minMonth || monthIndex(view) > monthIndex(minMonth);
  const canNext = !maxMonth || monthIndex(view) < monthIndex(maxMonth);
  const cell = isMobile ? 44 : 40;

  const panel = (
    <div role="dialog" aria-label={`Escolher ${label}`} onClick={(e) => e.stopPropagation()} style={{ background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0 12px 40px rgba(15,23,42,0.18)", display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box", padding: 16, ...(isMobile ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 61, borderRadius: "20px 20px 0 0", paddingBottom: 24 } : { position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 61, width: 7 * cell + 32, borderRadius: 12 }) }}>
      {isMobile && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: TEXT, margin: 0 }}>{label}</p>
          <span role="button" aria-label="Fechar calendário" onClick={close} style={{ cursor: "pointer", display: "flex" }}>
            <X size={20} color={TEXT} />
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span role="button" aria-label="Mês anterior" aria-disabled={!canPrev} onClick={() => canPrev && setView((v) => addMonths(v, -1))} style={{ display: "flex", padding: 6, cursor: canPrev ? "pointer" : "default", opacity: canPrev ? 1 : 0.3 }}>
          <ChevronLeft size={20} color={TEXT} />
        </span>
        <p aria-live="polite" style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, margin: 0, textTransform: "capitalize" }}>{monthTitle(view)}</p>
        <span role="button" aria-label="Próximo mês" aria-disabled={!canNext} onClick={() => canNext && setView((v) => addMonths(v, 1))} style={{ display: "flex", padding: 6, cursor: canNext ? "pointer" : "default", opacity: canNext ? 1 : 0.3 }}>
          <ChevronRight size={20} color={TEXT} />
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${cell}px)`, justifyContent: "center", rowGap: 2 }}>
        {WEEKDAYS_PT.map((w, i) => (
          <p key={i} style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 12, color: MUTED, margin: 0, textAlign: "center", lineHeight: `${cell - 8}px` }}>{w}</p>
        ))}
        {monthCells(view.y, view.m0).map((c, i) => {
          if (!c) return <div key={i} style={{ height: cell }} />;
          const disabled = isDisabled(c.iso, min, max);
          const selected = c.iso === value;
          const isAnchor = !!anchor && c.iso === anchor && !selected;
          const between = !selected && !isAnchor && inBetween(c.iso, anchor, value);
          const isToday = c.iso === today;
          return (
            <div key={i} role="button" aria-label={`${longDate(c.iso)}${isAnchor ? ", dia da ida" : ""}`} aria-disabled={disabled} aria-pressed={selected} onClick={() => pick(c.iso)} style={{ height: cell, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer" }}>
              <span style={{ width: cell - 4, height: cell - 4, borderRadius: 999, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: selected || isToday ? 700 : 500, background: selected ? GREEN : isAnchor || between ? TINT : "transparent", border: isAnchor ? `1.5px solid ${GREEN}` : isToday && !selected ? `1px solid ${BORDER}` : "1px solid transparent", color: disabled ? SLATE : TEXT, textDecoration: disabled ? "line-through" : "none" }}>{c.day}</span>
            </div>
          );
        })}
      </div>
      {anchor && <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, margin: 0, textAlign: "center" }}>Dia da ida: {shortDate(anchor)}. Escolha a volta a partir dele.</p>}
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      <div role="button" tabIndex={0} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${value ? longDate(value) : "não escolhida"}`} onClick={open ? close : openCalendar} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open ? close() : openCalendar())} style={{ background: "#fff", border: `1px solid ${open ? GREEN : BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: isMobile ? "14px 16px" : "16px 24px", borderRadius: 8, cursor: "pointer" }}>
        <Calendar size={20} color={TEXT} />
        <p style={{ flex: 1, margin: 0, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: value ? TEXT : MUTED }}>{value ? shortDate(value) : label}</p>
      </div>
      {open && (
        <>
          <div data-testid="calendario-fundo" onClick={close} style={{ position: "fixed", inset: 0, zIndex: 60, background: isMobile ? "rgba(15,23,42,0.5)" : "transparent" }} />
          {panel}
        </>
      )}
    </div>
  );
}
