"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { isNativeApp, nativePlugin, APP_SCHEME } from "@/lib/nativeApp";

/**
 * Só faz algo dentro do app (Capacitor). No site comum não renderiza nada nem muda nada.
 * - marca <html class="is-native"> (áreas seguras do notch);
 * - botão voltar do Android navega no histórico (ou fecha o app na primeira tela);
 * - volta do login com Google (link br.com.tripsz.app://auth?code=...) e links tripsz.com.br abertos no app.
 */
export default function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    document.documentElement.classList.add("is-native");

    const App = nativePlugin("App");
    const Browser = nativePlugin("Browser");
    const StatusBar = nativePlugin("StatusBar");
    const SplashScreen = nativePlugin("SplashScreen");
    const handles = [];

    try { StatusBar?.setStyle?.({ style: "LIGHT" }); } catch { /* opcional */ }
    try { SplashScreen?.hide?.(); } catch { /* opcional */ }

    const onUrl = async (url) => {
      try {
        if (!url) return;
        if (url.startsWith(`${APP_SCHEME}://`)) {
          const parsed = new URL(url.replace(`${APP_SCHEME}://`, "https://app.local/"));
          const code = parsed.searchParams.get("code");
          try { await Browser?.close?.(); } catch { /* já fechou */ }
          if (code) {
            await supabaseBrowser().auth.exchangeCodeForSession(code);
            window.location.replace("/");
          }
          return;
        }
        // Link universal (https://www.tripsz.com.br/...): abre a mesma rota dentro do app.
        const u = new URL(url);
        if (/(^|\.)tripsz\.com\.br$/.test(u.hostname)) window.location.assign(u.pathname + u.search + u.hash);
      } catch { /* link inválido: ignora */ }
    };

    (async () => {
      try {
        const urlH = await App?.addListener?.("appUrlOpen", (e) => onUrl(e?.url));
        if (urlH) handles.push(urlH);
        const backH = await App?.addListener?.("backButton", (e) => {
          if (e?.canGoBack || window.history.length > 1) window.history.back();
          else App?.exitApp?.();
        });
        if (backH) handles.push(backH);
      } catch { /* sem plugin: segue sem */ }
    })();

    return () => handles.forEach((h) => { try { h.remove(); } catch { /* ok */ } });
  }, []);

  return null;
}
