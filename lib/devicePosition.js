"use client";
import { nativePlugin } from "./nativeApp";

/**
 * Onde a pessoa está agora: { lat, lon, accuracy } ou null (sem permissão, sem GPS ou demorou). No app usa o plugin nativo;
 * no navegador, o `navigator.geolocation`. (Mesma lógica do check-in por GPS do app, em arquivo à parte.)
 */
export async function getPosition() {
  const geo = nativePlugin("Geolocation");
  if (geo) {
    try {
      let perm = await geo.checkPermissions();
      if (perm?.location === "prompt" || perm?.location === "prompt-with-rationale") perm = await geo.requestPermissions();
      if (perm?.location !== "granted" && perm?.coarseLocation !== "granted") return null;
      const p = await geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
      return { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
    } catch {
      return null;
    }
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}
