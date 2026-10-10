"use client";

export function FontImports() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Lora:ital@0;1&family=JetBrains+Mono:wght@400;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      /* Trava contra a tela "sambar": mesmo que algum elemento fique mais
         largo que o celular, a página não anda pro lado nem faz o efeito
         de elástico. "clip" não cria uma área de rolagem própria, então a
         rolagem vertical e o window.scrollTo continuam normais. */
      html, body { max-width: 100%; overscroll-behavior-x: none; }
      body { overflow-x: hidden; overflow-wrap: break-word; }
      @supports (overflow: clip) { html, body { overflow-x: clip; } }
      img { max-width: 100%; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes tripsz-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(0.94); } }
    `}</style>
  );
}
