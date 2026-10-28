"use client";
/**
 * Card compartilhável da conquista (formato Stories 1080x1920) e os caminhos de compartilhar.
 * O card é um SVG: a MESMA imagem aparece na tela e vai pro Instagram/WhatsApp (PNG).
 */
import { isNativeApp, nativePlugin } from "./nativeApp";
import { SITE_URL } from "./siteUrl";

const W = 1080, H = 1920;
const FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'Courier New', monospace";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const shareLink = () => `${SITE_URL}/?utm_source=conquista&utm_medium=share`;
export const shareText = (a) => `Acabei de desbloquear "${a.label}" no tripsz! 🏟️ Registre os estádios que você já visitou e monte seu Football Passport: ${shareLink()}`;

// Ícones (24x24, traço) — mesmos desenhos do lucide usados na tela de conquistas.
const ICON_PATHS = {
  award: `<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>`,
  trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-1.97 1.5C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98 1.97 1.5C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  globe: `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
};
const STADIUM_PATH = "M5 3L1 5V1L5 3ZM16 1V5L20 3L16 1ZM9 0V4L13 2L9 0ZM11 16H9V20C3.95 19.85 0 18.56 0 17V8C0 6.34 4.48 5 10 5C15.52 5 20 6.34 20 8V17C20 18.56 16.05 19.85 11 20V16ZM3 8.04C4.38 8.53 6.77 9 10 9C13.23 9 15.62 8.53 17 8.04C17 7.86 14.22 7 10 7C5.78 7 3 7.86 3 8.04ZM18 9.8C16.18 10.53 13.27 11 10 11C6.73 11 3.82 10.53 2 9.8V16.58C2.61 16.99 4.36 17.59 7 17.86V14H13V17.86C15.64 17.59 17.39 16.99 18 16.58V9.8Z";

function iconSvg(kind, cx, cy, size, color) {
  if (kind === "stadium") {
    const k = size / 20;
    return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${k})"><path d="${STADIUM_PATH}" fill="${color}"/></g>`;
  }
  const k = size / 24;
  return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${k})" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[kind] || ICON_PATHS.award}</g>`;
}

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

let logoUri = null;
async function loadLogo() {
  if (logoUri) return logoUri;
  try {
    const txt = await (await fetch("/logo-tripsz.svg")).text();
    logoUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(txt)))}`;
  } catch {
    logoUri = "";
  }
  return logoUri;
}

/** SVG do card (string). achievement: { label, category, kind, name } */
export async function buildCardSvg(a) {
  const logo = await loadLogo();
  const lines = wrap(a.label, 14);
  const fs = lines.length > 1 ? 92 : 108;
  const titleY = 960;
  const titleSvg = lines.map((l, i) => `<text x="540" y="${titleY + i * (fs + 8)}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${fs}" fill="#0f172a">${esc(l)}</text>`).join("");
  const afterTitle = titleY + (lines.length - 1) * (fs + 8);
  const who = a.name ? `${a.name} desbloqueou` : "Desbloqueado";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00d65a"/><stop offset="1" stop-color="#007a33"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<circle cx="980" cy="160" r="360" fill="#ffffff" fill-opacity="0.07"/><circle cx="80" cy="1560" r="420" fill="#ffffff" fill-opacity="0.07"/>
<rect x="80" y="250" width="920" height="960" rx="64" fill="#ffffff"/>
${logo ? `<image href="${logo}" x="${540 - 150}" y="320" width="300" height="83"/>` : ""}
<text x="540" y="500" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="30" letter-spacing="4" fill="#00a63e">CONQUISTA DESBLOQUEADA</text>
<circle cx="540" cy="700" r="150" fill="#e8f9ee"/><circle cx="540" cy="700" r="150" fill="none" stroke="#00c853" stroke-width="10"/>
${iconSvg(a.kind, 540, 700, 150, "#00c853")}
${titleSvg}
<text x="540" y="${afterTitle + 70}" text-anchor="middle" font-family="${MONO}" font-size="30" letter-spacing="2" fill="#64748b">${esc(String(a.category).toUpperCase())}</text>
<text x="540" y="${afterTitle + 150}" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="38" fill="#334155">${esc(who)}</text>
<text x="540" y="1400" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="62" fill="#ffffff">Quantos estádios</text>
<text x="540" y="1475" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="62" fill="#ffffff">você já visitou?</text>
<text x="540" y="1545" text-anchor="middle" font-family="${FONT}" font-size="36" fill="#ffffff" fill-opacity="0.92">Monte seu Football Passport grátis</text>
<rect x="290" y="1610" width="500" height="104" rx="52" fill="#ffffff"/>
<text x="540" y="1676" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="40" fill="#007a33">tripsz.com.br</text>
</svg>`;
}

export const svgToDataUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** PNG (Blob) do card, pronto pra compartilhar. */
export function svgToPng(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      c.getContext("2d").drawImage(img, 0, 0, W, H);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png");
    };
    img.onerror = () => reject(new Error("img"));
    img.src = svgToDataUri(svg);
  });
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] || "");
  r.onerror = reject;
  r.readAsDataURL(blob);
});

function download(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "tripsz-conquista.png";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** O aparelho abre a folha de compartilhar com imagem (Instagram Stories, WhatsApp...)? */
export function canShareImage() {
  try {
    if (isNativeApp() && nativePlugin("Share") && nativePlugin("Filesystem")) return true;
    const f = new File([new Blob(["x"])], "x.png", { type: "image/png" });
    return !!(navigator.canShare && navigator.canShare({ files: [f] }));
  } catch {
    return false;
  }
}

/** Compartilha a imagem. Devolve "shared" | "downloaded" | "cancelled". */
export async function shareImage(blob, a) {
  const text = shareText(a);
  try {
    const Share = nativePlugin("Share"), FS = nativePlugin("Filesystem");
    if (isNativeApp() && Share && FS) {
      const w = await FS.writeFile({ path: "tripsz-conquista.png", data: await blobToBase64(blob), directory: "CACHE" });
      await Share.share({ title: "Minha conquista no tripsz", text, files: [w.uri], dialogTitle: "Compartilhar conquista" });
      return "shared";
    }
    const file = new File([blob], "tripsz-conquista.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text, title: "Minha conquista no tripsz" });
      return "shared";
    }
  } catch (e) {
    if (e && (e.name === "AbortError" || /cancel/i.test(String(e.message)))) return "cancelled";
  }
  download(blob);
  return "downloaded";
}

/** WhatsApp com o texto + link (a imagem vai pelo botão de Stories / folha de compartilhar). */
export function openWhatsApp(a) {
  const url = `https://wa.me/?text=${encodeURIComponent(shareText(a))}`;
  const browser = nativePlugin("Browser");
  if (isNativeApp() && browser) browser.open({ url });
  else window.open(url, "_blank", "noopener");
}
