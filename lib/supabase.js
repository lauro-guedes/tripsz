import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente usado no navegador (componentes 'use client').
 * Faz login, cadastro e leituras que respeitam as regras de
 * segurança (RLS) do Supabase.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Cliente usado só no servidor (rotas de API), com a chave
 * "service_role" — ignora as regras de segurança, por isso
 * nunca deve ser exposto ao navegador. Usado pelo webhook do
 * Mercado Pago pra marcar um pedido como pago.
 */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
