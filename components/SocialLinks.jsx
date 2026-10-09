"use client";
/**
 * Redes sociais do rodapé.
 *
 * Pra definir ou trocar o endereço do Instagram, mude SÓ a constante
 * INSTAGRAM_URL abaixo (ex.: "https://www.instagram.com/seuusuario/").
 * Se ela ficar vazia, o ícone não aparece — é melhor não mostrar nada do que
 * levar a pessoa pra um perfil errado.
 */
import { Instagram } from "lucide-react";
import { BODY, FONT_DISPLAY } from "../lib/tokens";

export const INSTAGRAM_URL = "https://www.instagram.com/tripsz.app/";

export default function SocialLinks({ instagramUrl = INSTAGRAM_URL }) {
  if (!instagramUrl) return null;
  return (
    <a
      href={instagramUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Instagram da tripsz"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT_DISPLAY, fontSize: 14, color: BODY, textDecoration: "none" }}
    >
      <Instagram size={18} color={BODY} />
      <span>Instagram</span>
    </a>
  );
}
