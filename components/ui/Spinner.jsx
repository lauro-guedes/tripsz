"use client";

/** Rodinha de carregando (CSS puro, sem imagem). `color` é a cor da parte que gira. */
export function Spinner({ size = 18, color = "#0f172a" }) {
  return (
    <>
      <style>{"@keyframes tripszSpin{to{transform:rotate(360deg)}}"}</style>
      <span role="status" aria-label="Carregando" style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${color}33`, borderTopColor: color, display: "inline-block", boxSizing: "border-box", animation: "tripszSpin 0.8s linear infinite", flexShrink: 0 }} />
    </>
  );
}
