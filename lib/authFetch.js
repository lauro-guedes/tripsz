"use client";
/**
 * fetch() que já leva o token de login do Supabase — use nas chamadas à API
 * que exigem uma pessoa logada (assinatura, checkout, perfil, painel admin).
 * O servidor confere o token (lib/serverAuth.js) em vez de acreditar num
 * userId digitado pelo navegador.
 */
import { supabaseBrowser } from "./supabase";

export async function authFetch(url, options = {}) {
  let token = null;
  try {
    const { data } = await supabaseBrowser().auth.getSession();
    token = data?.session?.access_token || null;
  } catch {
    // sem sessão: a API responde 401
  }
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}
