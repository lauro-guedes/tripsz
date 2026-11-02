"use client";
/**
 * Foto de capa e de perfil: confere o arquivo, reduz no próprio aparelho (foto de celular tem 5 a 12 MB) e envia ao
 * Storage do Supabase, na pasta da pessoa (bucket "social": ver supabase-social-fase1.sql).
 */
import { supabaseBrowser } from "./supabase";

export const ACCEPT = "image/jpeg,image/png,image/webp";
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // o arquivo original; o que sobe é bem menor depois de reduzido
const TYPES = ACCEPT.split(",");

/** null se o arquivo serve; senão a mensagem pra mostrar. */
export function checkImageFile(file) {
  if (!file) return "Escolha uma imagem.";
  if (!TYPES.includes(file.type)) return "Use uma imagem JPG, PNG ou WebP.";
  if (file.size > MAX_UPLOAD_BYTES) return "A imagem é grande demais (máximo 12 MB).";
  return null;
}

/**
 * Plano de redução: recorte (sx, sy, sw, sh) e tamanho final (dw, dh). `square`: recorta o centro em quadrado (foto de perfil).
 * Nunca amplia: imagem menor que `maxSide` mantém o tamanho.
 */
export function planResize(w, h, { maxSide = 1600, square = false } = {}) {
  let sx = 0, sy = 0, sw = w, sh = h;
  if (square) {
    const side = Math.min(w, h);
    sx = Math.round((w - side) / 2);
    sy = Math.round((h - side) / 2);
    sw = side;
    sh = side;
  }
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  return { sx, sy, sw, sh, dw: Math.max(1, Math.round(sw * scale)), dh: Math.max(1, Math.round(sh * scale)) };
}

/** Reduz no navegador (canvas) e devolve um Blob JPEG. */
export async function resizeImage(file, opts = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("imagem inválida"));
      el.src = url;
    });
    const p = planResize(img.naturalWidth, img.naturalHeight, opts);
    const canvas = document.createElement("canvas");
    canvas.width = p.dw;
    canvas.height = p.dh;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // PNG com fundo transparente vira JPEG sem ficar preto
    ctx.fillRect(0, 0, p.dw, p.dh);
    ctx.drawImage(img, p.sx, p.sy, p.sw, p.sh, 0, 0, p.dw, p.dh);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("falha ao reduzir"))), "image/jpeg", opts.quality || 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Confere, reduz e envia. kind: "cover" | "avatar". Devolve { ok, url } ou { ok: false, message }. */
export async function uploadSocialImage(userId, kind, file, { supabase } = {}) {
  const bad = checkImageFile(file);
  if (bad) return { ok: false, message: bad };
  try {
    const blob = await resizeImage(file, kind === "avatar" ? { maxSide: 512, square: true } : { maxSide: 1600 });
    const client = supabase || supabaseBrowser();
    const path = `${userId}/${kind}-${Date.now()}.jpg`;
    const { error } = await client.storage.from("social").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) return { ok: false, message: "Não foi possível enviar a imagem. Tente de novo." };
    return { ok: true, url: client.storage.from("social").getPublicUrl(path).data.publicUrl };
  } catch {
    return { ok: false, message: "Não foi possível ler essa imagem. Tente outra." };
  }
}
