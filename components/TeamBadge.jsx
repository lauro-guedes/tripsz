"use client";
/**
 * Escudo de um time (imagem redonda do clube, ou as iniciais quando não
 * há imagem). Usado em Meus jogos, Buscar jogos, Meu calendário e no
 * roteiro. Veja a explicação da ordem de tentativas logo acima do componente.
 */
import { useState, useEffect } from "react";
import { BG_ALT, BORDER, MUTED, FONT_DISPLAY } from "../lib/tokens";
import { TEAM_LOGO_IDS, TEAM_LOGO_BUCKET } from "../lib/teamLogoIds";
import { initials } from "../lib/textUtils";


// "…/teams/134.png" (API-Football) ou "…/team-logos/134.png" (nossa cópia) -> 134
function logoIdFromUrl(u) {
  const m = /\/(?:teams|team-logos)\/(\d+)\.png/.exec(u || "");
  return m ? Number(m[1]) : null;
}

// Escudos achados pelo nome (jogos que ficaram sem escudo): guarda o
// resultado enquanto a página está aberta, pra não perguntar duas vezes.
const logoByNameCache = new Map();
const logoByNameInflight = new Map();
function resolveLogoByName(name) {
  const key = (name || "").trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  if (logoByNameCache.has(key)) return Promise.resolve(logoByNameCache.get(key));
  if (logoByNameInflight.has(key)) return logoByNameInflight.get(key);
  const p = fetch(`/api/teams/logo?name=${encodeURIComponent(name.trim())}`)
    .then((r) => (r.ok ? r.json() : { logo: null }))
    .then((d) => d.logo || null)
    .catch(() => null)
    .then((logo) => {
      logoByNameCache.set(key, logo);
      logoByNameInflight.delete(key);
      return logo;
    });
  logoByNameInflight.set(key, p);
  return p;
}

/**
 * Escudo de um time. Tenta, nessa ordem: o link que veio com o jogo ->
 * nossa cópia no Supabase (pelo ID do time) -> o CDN da API-Football (pelo
 * ID) -> [se resolve=true] procurar o escudo pelo NOME do time. Só mostra
 * as iniciais quando nenhuma dessas funciona, então não aparece mais
 * escudo quebrado nem time sem escudo à toa.
 */
export default function TeamBadge({ name, url, size = 32, resolve = false }) {
  const urlId = logoIdFromUrl(url);
  const id = urlId || TEAM_LOGO_IDS[name];
  const ourCopy = id ? `${TEAM_LOGO_BUCKET}/${id}.png` : null;
  const apiCdn = id ? `https://media.api-sports.io/football/teams/${id}.png` : null;
  // Quando o link do jogo é de um escudo com ID conhecido, tenta primeiro a NOSSA cópia
  // (storage do Supabase, rápida) e só depois o CDN da API-Football, que é mais lento
  // e às vezes falha. Links de outra origem continuam sendo tentados primeiro.
  const candidates = (urlId ? [ourCopy, url, apiCdn] : [url, ourCopy, apiCdn]).filter((v, i, arr) => v && arr.indexOf(v) === i);
  const candidatesKey = candidates.join("|");
  const nameKey = (name || "").trim().toLowerCase();

  const [step, setStep] = useState(0);
  const [byName, setByName] = useState(() => (logoByNameCache.has(nameKey) ? logoByNameCache.get(nameKey) : undefined));
  // Link ou nome mudou (a lista recarregou com outro dado): recomeça do zero.
  useEffect(() => {
    setStep(0);
  }, [candidatesKey]);
  useEffect(() => {
    setByName(logoByNameCache.has(nameKey) ? logoByNameCache.get(nameKey) : undefined);
  }, [nameKey]);

  const exhausted = step >= candidates.length;
  useEffect(() => {
    if (!exhausted || !resolve || byName !== undefined) return undefined;
    let alive = true;
    resolveLogoByName(name).then((found) => {
      if (alive) setByName(found);
    });
    return () => {
      alive = false;
    };
  }, [exhausted, resolve, byName, name]);

  const src = exhausted ? byName || null : candidates[step];
  if (!src) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: BG_ALT, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: size * 0.38, color: MUTED, margin: 0 }}>{initials(name)}</p>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      decoding="async"
      onError={() => (exhausted ? setByName(null) : setStep((n) => n + 1))}
      style={{ objectFit: "contain", flexShrink: 0 }}
    />
  );
}
