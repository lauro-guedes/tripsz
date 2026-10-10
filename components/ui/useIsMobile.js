"use client";
import { useEffect, useState } from "react";

// Detecta telas estreitas (celular) e reage a mudanças de tamanho/rotação,
// pra todo componente poder alternar entre o layout desktop (Figma 95:*) e
// o layout mobile (Figma 125:*) sem precisar de dois arquivos separados.
export function useIsMobile() {
  // Sempre começa como "desktop" (false), igual ao que o servidor
  // renderiza — ele não tem como saber o tamanho da tela de ninguém.
  // O valor real só é aplicado depois, dentro do useEffect (que só roda
  // no navegador, depois que a página já "bateu" com o servidor). Sem
  // isso, num navegador estreito, a primeira renderização do cliente já
  // vinha diferente da do servidor, e o React travava com um erro de
  // hidratação (#418/#423/#425) — que podia deixar a página inteira,
  // incluindo botões, sem funcionar.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}
