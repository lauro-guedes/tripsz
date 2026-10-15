"use client";
import { useEffect, useState } from "react";

/**
 * Estado de "conectando ao Google": do clique até a página sair do site. O Supabase leva a pessoa pro Google
 * (alguns segundos de rede); sem aviso parecia travado e dava pra clicar de novo.
 * `run(start)`: `start` devolve true se deu erro (a página NÃO saiu); aí o botão é liberado de novo.
 */
export function useGoogleLoading() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Voltar do Google pelo botão "voltar" pode reabrir a página como ela estava (com o carregando ainda ligado).
    const onShow = (e) => {
      if (e.persisted) setLoading(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const run = async (start) => {
    if (loading) return; // segundo clique enquanto conecta: ignora
    setLoading(true);
    let failed = true;
    try {
      failed = await start();
    } catch {
      failed = true;
    }
    if (failed) setLoading(false);
  };

  return { loading, run };
}
