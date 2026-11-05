"use client";
import { useRef, useState } from "react";
import { authFetch } from "../../lib/authFetch";

const GREEN = "#00d66f";
const BORDER = "#dee7e2";
const TEXT = "#102018";
const MUTED = "#53645b";

export const BROADCAST_ERRORS = { auth: "a chave GEMINI_API_KEY é inválida ou não tem permissão", quota: "o limite de uso do Gemini estourou", timeout: "o Gemini demorou demais", blocked: "o Gemini recusou o pedido", network: "não foi possível falar com o Gemini", upstream: "o Gemini está com problema", bad_response: "a resposta do Gemini veio quebrada", unknown: "erro desconhecido" };

/** Teste do "Onde assistir": pergunta ao Gemini os próximos jogos e mostra tudo (pedido, resposta crua, fontes, aceitos e recusados). */
export function BroadcastsView({ email }) {
  const [busy, setBusy] = useState(null);
  const busyRef = useRef(false); // trava imediata: dois cliques seguidos não podem gastar duas consultas do Gemini
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const run = async (scope, save) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(`${scope}${save ? "s" : "t"}`);
    setErr(null);
    setRes(null);
    try {
      const r = await authFetch(`/api/admin/broadcasts-test?scope=${scope}&save=${save ? 1 : 0}&email=${encodeURIComponent(email)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error || "Não foi possível concluir agora.");
      else setRes(d);
    } catch { setErr("Não foi possível concluir agora."); } finally { busyRef.current = false; setBusy(null); }
  };
  const btn = (primary) => ({ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "9px 14px", cursor: "pointer", border: `1px solid ${primary ? GREEN : BORDER}`, background: primary ? GREEN : "#fff", color: primary ? "#04361c" : TEXT, opacity: busy ? 0.6 : 1 });
  const d = res && res.details;
  const channelsOf = (g) => (res.items && res.items[g.id] ? res.items[g.id].channels.map((c) => (c.note ? `${c.name} (${c.note})` : c.name)).join(" · ") : null);
  const rejectionOf = (g) => { const r = (res.rejected || []).find((x) => Number(x.id) === g.id); return r ? r.reason : "o Gemini não respondeu este jogo"; };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 26, letterSpacing: "-0.5px", color: TEXT, margin: 0 }}>Transmissões</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: "5px 0 0" }}>Onde assistir cada jogo (Brasil), buscado pelo Gemini com a busca do Google. Cada consulta pergunta uma leva de até 10 jogos.</p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div onClick={() => run("brasil", false)} style={btn(true)}>{busy === "brasilt" ? "Testando..." : "Brasil · testar (não salva)"}</div>
        <div onClick={() => run("brasil", true)} style={btn(false)}>{busy === "brasils" ? "Salvando..." : "Brasil · testar e salvar"}</div>
        <div onClick={() => run("europa", false)} style={btn(false)}>{busy === "europat" ? "Testando..." : "Europa e Libertadores · testar"}</div>
      </div>
      {err && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#dc2626", margin: 0 }}>{err}</p>}
      {res && res.skipped === "sem_chave" && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#b45309", margin: 0 }}>A chave GEMINI_API_KEY não está configurada neste ambiente (ou o deploy ainda não pegou).</p>}
      {res && res.none && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, margin: 0 }}>{res.message || "Nenhum jogo para testar."}</p>}
      {res && res.ok === false && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#dc2626", margin: 0 }}>O Gemini não respondeu: {BROADCAST_ERRORS[res.kind] || BROADCAST_ERRORS.unknown}.</p>}
      {d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>
            <b>{res.asked}</b> perguntados · <b style={{ color: "#0b6b3a" }}>{res.accepted} aceitos</b> · <b style={{ color: res.rejected.length ? "#b45309" : TEXT }}>{res.rejected.length} recusados</b> · {(d.ms / 1000).toFixed(1).replace(".", ",")} s · {d.model} · {d.saved ? "SALVO no banco" : "não salvo"}
          </p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: d.trusted ? "#0b6b3a" : "#dc2626", margin: 0 }}>
            Fontes: {d.trusted ? "confiáveis" : "NÃO confiáveis (nada é aceito)"} · {d.hosts.length ? d.hosts.join(", ") : "nenhuma fonte devolvida"}
          </p>
          {d.unknown.length > 0 && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#b45309", margin: 0 }}>Canais que o app não conhece (ignorados): {[...new Set(d.unknown)].join(", ")}</p>}
          {d.games.map((g) => {
            const ch = channelsOf(g);
            return (
              <div key={g.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, color: TEXT, margin: 0 }}>{g.label}</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: MUTED, margin: 0 }}>{g.league} · {new Date(g.kickoff).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: ch ? "#0b6b3a" : "#b45309", margin: 0 }}>{ch ? `📺 ${ch}` : `Recusado: ${rejectionOf(g)}`}</p>
              </div>
            );
          })}
          <details><summary style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, cursor: "pointer" }}>Resposta crua do Gemini</summary><pre style={{ fontSize: 11, whiteSpace: "pre-wrap", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>{d.text}</pre></details>
          <details><summary style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, cursor: "pointer" }}>Pedido enviado e buscas feitas</summary><pre style={{ fontSize: 11, whiteSpace: "pre-wrap", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>{d.prompt}{d.queries && d.queries.length ? `\n\nBuscas do Google: ${d.queries.join(" | ")}` : ""}</pre></details>
          <details><summary style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, cursor: "pointer" }}>Fontes devolvidas ({d.sources.length})</summary><pre style={{ fontSize: 11, whiteSpace: "pre-wrap", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>{d.sources.map((x) => `${x.title || "(sem título)"}  →  ${x.uri}`).join("\n")}</pre></details>
        </div>
      )}
    </div>
  );
}
