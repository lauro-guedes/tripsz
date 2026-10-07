import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente usado no navegador (componentes 'use client').
 * Faz login, cadastro e leituras que respeitam as regras de
 * segurança (RLS) do Supabase.
 *
 * IMPORTANTE: guardamos numa variável (singleton) em vez de criar um
 * cliente novo a cada chamada. O Supabase renova a sessão sozinho por
 * trás dos panos usando um timer preso à instância do cliente — se a
 * gente cria uma instância nova toda hora (essa função é chamada em
 * dezenas de lugares), o timer de renovação de uma instância antiga se
 * perde, e a sessão passa a expirar de verdade em vez de renovar
 * silenciosamente. Reaproveitar a mesma instância corrige isso.
 */
let browserClient = null;
export function supabaseBrowser() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return browserClient;
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
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      global: {
        // IMPORTANTE: o supabase-js usa fetch por baixo, e no servidor o
        // Next.js GUARDA (cache) as respostas de fetch por padrão. Sem isto,
        // a primeira consulta de um endereço ficava "congelada": uma consulta
        // que voltou vazia ("essa data ainda não foi lida") continuava
        // voltando vazia pra sempre, mesmo depois de o dado ser gravado — e o
        // cache dos jogos nunca valia, relendo a API a cada pedido. Com
        // no-store, toda consulta ao banco vai ao banco de verdade.
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
