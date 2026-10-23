"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../lib/authFetch";
import { checkPassportAccess } from "../../lib/passportAccess";
import { nativePlugin } from "../../lib/nativeApp";
import { supabaseBrowser } from "../../lib/supabase";
import { BORDER, FONT_DISPLAY, GREEN, GREEN_BG, MUTED, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";

/**
 * Check-in por GPS (só no APP, logado). Ao abrir o app, e ao voltar pra ele,
 * vê onde a pessoa está: se estiver num estádio com jogo começando em até 3h
 * (ou que começou há até 3h), pergunta se ela quer registrar o jogo.
 */
const MIN_GAP_MS = 5 * 60 * 1000; // não confere o GPS mais de uma vez a cada 5 min
let lastCheck = 0;

const asked = (id) => { try { return !!localStorage.getItem(`tripsz:checkin:${id}`); } catch { return false; } };
const markAsked = (id, v) => { try { localStorage.setItem(`tripsz:checkin:${id}`, v); } catch { /* sem storage */ } };

async function getPosition() {
  const geo = nativePlugin("Geolocation");
  if (geo) {
    try {
      let perm = await geo.checkPermissions();
      if (perm?.location === "prompt" || perm?.location === "prompt-with-rationale") perm = await geo.requestPermissions();
      if (perm?.location !== "granted" && perm?.coarseLocation !== "granted") return null;
      const p = await geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
      return { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
    } catch {
      return null;
    }
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

export function CheckinPopup({ onNavigate }) {
  const [game, setGame] = useState(null);
  const [state, setState] = useState("ask"); // ask | saving | done | error
  const [message, setMessage] = useState("");
  const busy = useRef(false);

  const run = useCallback(async (force) => {
    if (busy.current) return;
    if (!force && Date.now() - lastCheck < MIN_GAP_MS) return;
    busy.current = true;
    try {
      const { data } = await supabaseBrowser().auth.getSession();
      if (!data?.session) return;
      lastCheck = Date.now();
      const pos = await getPosition();
      if (!pos) return;
      const res = await authFetch("/api/checkin/nearby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pos) });
      const json = await res.json().catch(() => null);
      const g = json?.ok ? (json.games || []).find((x) => !asked(x.fixtureId)) : null;
      if (g) { setState("ask"); setMessage(""); setGame(g); }
    } catch {
      /* check-in é um extra: se falhar, segue sem avisar */
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    run(false);
    const appPlugin = nativePlugin("App");
    let handle = null;
    try {
      const p = appPlugin?.addListener?.("appStateChange", (s) => { if (s?.isActive) run(false); });
      Promise.resolve(p).then((h) => { handle = h; });
    } catch { /* sem plugin: só confere ao abrir */ }
    return () => { try { handle?.remove?.(); } catch { /* ok */ } };
  }, [run]);

  const dismiss = () => { if (game) markAsked(game.fixtureId, "no"); setGame(null); };

  const confirm = async () => {
    setState("saving");
    try {
      const access = await checkPassportAccess();
      if (!access.userId) throw new Error("Sessão expirada. Entre novamente.");
      if (!access.canAddMoreGames) throw new Error(`Você atingiu o limite de ${access.gamesLimit} jogos do plano grátis. Assine pra registrar mais.`);
      const { error } = await supabaseBrowser().from("attended_games").insert({
        user_id: access.userId,
        source: "api",
        api_fixture_id: game.fixtureId,
        home_team: game.home,
        away_team: game.away,
        home_logo: game.homeLogo,
        away_logo: game.awayLogo,
        match_date: game.matchDate,
        stadium: game.stadium,
        city: game.city,
        country: game.country || "—",
        competition: game.competition,
      });
      if (error) throw error;
      markAsked(game.fixtureId, "yes");
      setState("done");
    } catch (e) {
      setMessage(e?.message || "Não deu pra registrar agora.");
      setState("error");
    }
  };

  if (!game) return null;
  const time = (() => { try { return new Date(game.kickoff).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); } catch { return ""; } })();

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(15,23,42,0.45)" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px calc(24px + env(safe-area-inset-bottom))", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: GREEN_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="stadium" size={24} color={GREEN} />
          </div>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, lineHeight: 1.25, color: TEXT, margin: 0 }}>
            {state === "done" ? "Jogo registrado!" : `Você está no ${game.stadium}?`}
          </p>
        </div>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, margin: 0 }}>{game.home} × {game.away}</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{[game.competition, time && `Hoje às ${time}`, game.city].filter(Boolean).join(" · ")}</p>
        </div>
        {state === "error" && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{message}</p>}
        {state === "done" ? (
          <div style={{ display: "flex", gap: 10 }}>
            <div onClick={() => setGame(null)} style={{ flex: 1, textAlign: "center", padding: 14, borderRadius: 12, border: `1px solid ${BORDER}`, cursor: "pointer" }}><p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT, margin: 0 }}>Fechar</p></div>
            <div onClick={() => { setGame(null); onNavigate?.("jogos"); }} style={{ flex: 1, textAlign: "center", padding: 14, borderRadius: 12, background: GREEN, cursor: "pointer" }}><p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>Ver meus jogos</p></div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <div onClick={state === "saving" ? undefined : dismiss} style={{ flex: 1, textAlign: "center", padding: 14, borderRadius: 12, border: `1px solid ${BORDER}`, cursor: "pointer" }}><p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT, margin: 0 }}>Não</p></div>
            <div onClick={state === "saving" ? undefined : confirm} style={{ flex: 2, textAlign: "center", padding: 14, borderRadius: 12, background: GREEN, opacity: state === "saving" ? 0.6 : 1, cursor: "pointer" }}><p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{state === "saving" ? "Registrando..." : "Sim, registrar"}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}
