"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { checkNewAchievements } from "../../lib/achievements";
import { buildCardSvg, canShareImage, openWhatsApp, shareImage, svgToDataUri, svgToPng } from "../../lib/achievementShare";
import { GAMES_CHANGED_EVENT } from "../../lib/gamesEvents";
import { nativePlugin } from "../../lib/nativeApp";
import { supabaseBrowser } from "../../lib/supabase";
import { FONT_DISPLAY } from "../../lib/tokens";

/**
 * Tela cheia de "Conquista desbloqueada!" — web, responsivo e app.
 * Confere ao abrir, ao trocar de tela, ao voltar pro app e quando um jogo é registrado.
 * Cada conquista nova vira uma tela com o cartão (logo + convite) e botões de compartilhar.
 */
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 9) * 0.25, dur: 2.6 + (i % 5) * 0.5, size: 8 + (i % 4) * 3, color: ["#ffffff", "#b9f6ca", "#ffd54f", "#69f0ae"][i % 4] }));

export function AchievementWatcher({ active }) {
  const [queue, setQueue] = useState([]);
  const [svg, setSvg] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const running = useRef(false);
  const timer = useRef(null);
  const current = queue[0] || null;

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const { data } = await supabaseBrowser().auth.getSession();
      if (!data?.session) return;
      const fresh = await checkNewAchievements(supabaseBrowser());
      if (fresh.length) setQueue((q) => [...q, ...fresh.filter((f) => !q.some((x) => x.id === f.id))]);
    } catch {
      /* conquista é um extra: se falhar, segue sem avisar */
    } finally {
      running.current = false;
    }
  }, []);

  const schedule = useCallback((ms) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(run, ms);
  }, [run]);

  useEffect(() => {
    if (!active) return undefined;
    schedule(1200);
    // Teste: abra o site logado com ?testconquista=1 pra ver a tela (não conta como desbloqueio de verdade).
    try {
      if (new URLSearchParams(window.location.search).has("testconquista")) setQueue((q) => (q.length ? q : [{ id: "teste", label: "5 Estádios", category: "Estádios & Geografia", kind: "stadium", name: "Você" }]));
    } catch { /* ok */ }
    const onChange = () => schedule(900);
    window.addEventListener(GAMES_CHANGED_EVENT, onChange);
    let handle = null;
    try {
      Promise.resolve(nativePlugin("App")?.addListener?.("appStateChange", (s) => { if (s?.isActive) schedule(1500); })).then((h) => { handle = h; });
    } catch { /* sem plugin */ }
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener(GAMES_CHANGED_EVENT, onChange);
      try { handle?.remove?.(); } catch { /* ok */ }
    };
  }, [active, schedule]);

  // Monta o cartão da conquista que está na tela.
  useEffect(() => {
    let alive = true;
    setSvg(""); setNote("");
    if (current) buildCardSvg(current).then((s) => alive && setSvg(s)).catch(() => {});
    return () => { alive = false; };
  }, [current]);

  if (!current) return null;

  const next = () => setQueue((q) => q.slice(1));
  const onShare = async () => {
    if (busy || !svg) return;
    setBusy(true);
    try {
      const blob = await svgToPng(svg);
      const r = await shareImage(blob, current);
      if (r === "downloaded") setNote("Imagem salva! Agora é só postar nos Stories 🎉");
    } catch {
      setNote("Não deu pra gerar a imagem agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };
  const total = queue.length;
  const sharePhrase = canShareImage() ? "Compartilhar nos Stories" : "Baixar imagem para os Stories";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "linear-gradient(160deg,#00d65a 0%,#007a33 100%)", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden", paddingTop: "env(safe-area-inset-top)" }}>
      <style>{`
        @keyframes tz-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.04);opacity:1}100%{transform:scale(1)}}
        @keyframes tz-fall{0%{transform:translateY(-10vh) rotate(0);opacity:0}10%{opacity:1}100%{transform:translateY(110vh) rotate(540deg);opacity:.9}}
      `}</style>
      {CONFETTI.map((c, i) => (
        <span key={i} style={{ position: "absolute", top: 0, left: `${c.left}%`, width: c.size, height: c.size * 0.6, background: c.color, borderRadius: 2, opacity: 0, animation: `tz-fall ${c.dur}s linear ${c.delay}s infinite`, pointerEvents: "none" }} />
      ))}
      <div style={{ width: "100%", maxWidth: 520, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0", boxSizing: "border-box", position: "relative", zIndex: 1 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0, opacity: total > 1 ? 1 : 0 }}>{total > 1 ? `${total} conquistas novas` : "."}</p>
        <div onClick={next} role="button" aria-label="Fechar" style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={22} color="#fff" />
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 16px", boxSizing: "border-box", position: "relative", zIndex: 1 }}>
        {svg ? (
          <img src={svgToDataUri(svg)} alt={`Conquista desbloqueada: ${current.label}`} style={{ maxHeight: "100%", maxWidth: "100%", aspectRatio: "9 / 16", borderRadius: 20, boxShadow: "0 16px 40px rgba(0,0,0,0.3)", animation: "tz-pop .55s ease-out" }} />
        ) : (
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: "#fff" }}>Conquista desbloqueada!</p>
        )}
      </div>
      <div style={{ width: "100%", maxWidth: 520, padding: "8px 16px calc(16px + env(safe-area-inset-bottom))", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
        {note && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#fff", textAlign: "center", margin: 0 }}>{note}</p>}
        <div onClick={onShare} role="button" style={{ background: "#fff", borderRadius: 14, padding: 15, textAlign: "center", cursor: "pointer", opacity: busy || !svg ? 0.6 : 1 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: "#007a33", margin: 0 }}>{busy ? "Gerando imagem..." : sharePhrase}</p>
        </div>
        <div onClick={() => openWhatsApp(current)} role="button" style={{ background: "#25D366", borderRadius: 14, padding: 15, textAlign: "center", cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: "#fff", margin: 0 }}>Enviar no WhatsApp</p>
        </div>
        <div onClick={next} role="button" style={{ padding: 10, textAlign: "center", cursor: "pointer" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{total > 1 ? "Próxima conquista" : "Continuar"}</p>
        </div>
      </div>
    </div>
  );
}
