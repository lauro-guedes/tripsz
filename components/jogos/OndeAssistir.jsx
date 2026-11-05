"use client";
import { useBroadcast } from "../../lib/broadcastClient";
import { timeAgo } from "../../lib/social";
import { BODY, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";

const BEFORE = 3 * 3600 * 1000, AFTER = 10 * 86400 * 1000; // só jogos que ainda vão acontecer (ou começaram há pouco) e estão a até 10 dias

/**
 * "Onde assistir" de um jogo: os canais confirmados (com a observação de região), ou "Canal ainda não confirmado" com um link pra buscar.
 * Não mostra nada enquanto carrega, em jogo que não cobrimos, em jogo longe ou já encerrado, e nunca inventa canal.
 */
export function OndeAssistir({ fixtureId, kickoff, home, away }) {
  const t = new Date(kickoff).getTime();
  const near = fixtureId != null && Number.isFinite(t) && t >= Date.now() - BEFORE && t <= Date.now() + AFTER;
  const { ready, data, covered } = useBroadcast(near ? Number(fixtureId) : null);
  if (!near || !ready) return null;
  const channels = data && Array.isArray(data.channels) ? data.channels : [];
  if (channels.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: BODY, margin: 0 }}>
          <span aria-hidden="true">📺 </span><b style={{ color: TEXT }}>Onde assistir:</b> {channels.map((c) => (c.note ? `${c.name} (${c.note})` : c.name)).join(" · ")}
        </p>
        {data.confirmedAt && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, color: MUTED, margin: 0 }}>confirmado {timeAgo(data.confirmedAt)}</p>}
      </div>
    );
  }
  if (!covered) return null;
  const q = encodeURIComponent(`onde assistir ${home || ""} x ${away || ""}`.trim());
  return (
    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: MUTED, margin: 0 }}>
      <span aria-hidden="true">📺 </span>Canal ainda não confirmado · <a href={`https://www.google.com/search?q=${q}`} target="_blank" rel="noopener noreferrer" style={{ color: GREEN, fontWeight: 700, textDecoration: "none" }}>Ver onde assistir</a>
    </p>
  );
}
