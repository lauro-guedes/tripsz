"use client";

// A logo é um ARQUIVO (public/logo-tripsz.svg, proporção 123x34): pra trocar
// a logo no site inteiro, é só trocar esse arquivo — não precisa mexer aqui.
export function Wordmark({ onClick, height = 34 }) {
  return (
    <img
      src="/logo-tripsz.svg"
      alt="tripsz"
      width={(123 / 34) * height}
      height={height}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", flexShrink: 0 }}
    />
  );
}
