/**
 * Ponte entre o site e o app (Capacitor).
 *
 * O app nativo só abre o site publicado dentro de uma WebView; o Capacitor injeta
 * `window.Capacitor` e os plugins nativos. Aqui usamos só essa API injetada (nada é
 * importado), então no navegador comum tudo isto vira no-op e o site não muda.
 */
export const APP_SCHEME = "br.com.tripsz.app";
export const APP_AUTH_REDIRECT = `${APP_SCHEME}://auth`;

export function isNativeApp() {
  try {
    return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export function nativePlugin(name) {
  try {
    return window.Capacitor?.Plugins?.[name] || null;
  } catch {
    return null;
  }
}

/**
 * "Entrar com Google". No site: redireciona como sempre. No app: o Google bloqueia login
 * dentro de WebView, então abre o navegador do sistema e volta pelo link `br.com.tripsz.app://auth`
 * (tratado em NativeBridge). Devolve { error }.
 */
export async function signInWithGoogle(supabase, redirectTo) {
  if (!isNativeApp()) {
    return supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo || window.location.origin } });
  }
  const browser = nativePlugin("Browser");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: APP_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { data, error: error || new Error("Não foi possível abrir o Google.") };
  if (browser?.open) await browser.open({ url: data.url });
  else window.location.href = data.url;
  return { data, error: null };
}
