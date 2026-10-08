"use client";
/**
 * Escudo de um time (imagem redonda do clube, ou as iniciais quando não
 * há imagem). Usado em Meus jogos, Buscar jogos, Meu calendário e no roteiro.
 *
 * Como funciona (cache permanente):
 *  1. Procura o escudo na memória da página e no localStorage do navegador.
 *  2. Se não tem, pergunta UMA vez ao servidor (/api/teams/logo), que lê a
 *     tabela `team_logos`; se o time nunca foi buscado, o servidor busca na
 *     API-Football, confere que é uma imagem de verdade, guarda a cópia no
 *     nosso storage e grava o link na tabela.
 *  3. Dali em diante, esse time nunca mais gera chamada à API — nem do servidor,
 *     nem deste navegador.
 * Enquanto carrega (ou quando não existe escudo) mostra as iniciais.
 */
import { useState, useEffect } from "react";
import { BG_ALT, BORDER, MUTED, FONT_DISPLAY } from "../lib/tokens";
import { TEAM_LOGO_IDS } from "../lib/teamLogoIds";
import { initials } from "../lib/textUtils";

const STORAGE_KEY = "tripsz_logo_cache_v2";
const MAX_PARALLEL = 6;

// "…/teams/134.png" (API-Football) ou "…/team-logos/134.png" (nossa cópia) -> 134
function logoIdFromUrl(u) {
  const m = /\/(?:teams|team-logos)\/(\d+)\.png/.exec(u || "");
  return m ? Number(m[1]) : null;
}

const normName = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* ---- cache do navegador (memória + localStorage) ---- */
const memory = new Map(); // chave -> link | null (null = não achou nesta sessão)
const inflight = new Map(); // chave -> Promise
let storageLoaded = false;

function loadStorage() {
  if (storageLoaded) return;
  storageLoaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    Object.entries(raw).forEach(([k, v]) => memory.set(k, v));
  } catch {
    // sem localStorage: segue só com a memória
  }
}
function saveStorage(key, url) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    raw[key] = url;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch {
    // ignora
  }
}
function forget(key) {
  memory.delete(key);
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    delete raw[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch {
    // ignora
  }
}

/* ---- fila: no máximo MAX_PARALLEL perguntas ao servidor ao mesmo tempo ---- */
let running = 0;
const waiting = [];
function enqueue(task) {
  return new Promise((resolve) => {
    const run = () => {
      running += 1;
      task().then(resolve, () => resolve(null)).finally(() => {
        running -= 1;
        if (waiting.length) waiting.shift()();
      });
    };
    if (running < MAX_PARALLEL) run();
    else waiting.push(run);
  });
}

function fetchLogo(key, id, name) {
  if (inflight.has(key)) return inflight.get(key);
  const qs = new URLSearchParams();
  if (id) qs.set("id", String(id));
  if (name) qs.set("name", name);
  const p = enqueue(() => fetch(`/api/teams/logo?${qs.toString()}`).then((r) => (r.ok ? r.json() : { logo: null })))
    .then((d) => {
      const logo = (d && d.logo) || null;
      memory.set(key, logo);
      if (logo) saveStorage(key, logo); // "não achou" fica só na memória: o servidor tenta de novo em 7 dias
      return logo;
    })
    .catch(() => null)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export default function TeamBadge({ name, url, size = 32 }) {
  const id = logoIdFromUrl(url) || TEAM_LOGO_IDS[name] || null;
  const key = id ? `id:${id}` : `name:${normName(name)}`;
  const valid = !!id || normName(name).length >= 3;

  const [src, setSrc] = useState(() => {
    if (typeof window === "undefined") return null;
    loadStorage();
    return memory.get(key) || null;
  });

  useEffect(() => {
    if (!valid) {
      setSrc(null);
      return undefined;
    }
    loadStorage();
    if (memory.has(key)) {
      setSrc(memory.get(key) || null);
      return undefined;
    }
    setSrc(null);
    let alive = true;
    fetchLogo(key, id, name).then((logo) => {
      if (alive) setSrc(logo);
    });
    return () => {
      alive = false;
    };
  }, [key, valid, id, name]);

  if (!src) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: BG_ALT, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: size * 0.38, color: MUTED, margin: 0 }}>{initials(name)}</p>
      </div>
    );
  }
  return (
    <img
      key={src}
      src={src}
      alt={name}
      width={size}
      height={size}
      decoding="async"
      // Cópia nossa ficou ruim (ou sumiu): esquece, mostra as iniciais e deixa o servidor refazer na próxima vez.
      onError={() => {
        forget(key);
        memory.set(key, null);
        setSrc(null);
      }}
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth <= 8) {
          forget(key);
          memory.set(key, null);
          setSrc(null);
        }
      }}
      style={{ objectFit: "contain", flexShrink: 0 }}
    />
  );
}
