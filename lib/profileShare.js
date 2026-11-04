/** Compartilhar o perfil: a folha de compartilhar do aparelho (WhatsApp, Instagram, Mensagens...). Sem ela, copia o link. */
import { nativePlugin, isNativeApp } from "./nativeApp";
import { SITE_URL } from "./siteUrl";

export const profileLink = (username) => `${SITE_URL}/p/${username}`;

/** Devolve "shared" | "copied" | "cancelled" | "failed". */
export async function shareProfile(username, displayName) {
  const url = profileLink(username);
  const text = `Veja o perfil de ${displayName || `@${username}`} no tripsz: os estádios que visitou e os jogos que viveu.`;
  try {
    const Share = nativePlugin("Share");
    if (isNativeApp() && Share && Share.share) {
      await Share.share({ title: "Perfil no tripsz", text, url, dialogTitle: "Compartilhar perfil" });
      return "shared";
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: "Perfil no tripsz", text, url });
      return "shared";
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch (e) {
    if (e && (e.name === "AbortError" || /cancel/i.test(String(e.message)))) return "cancelled";
  }
  return "failed";
}
