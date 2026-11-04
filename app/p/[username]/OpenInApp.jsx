"use client";
import { useEffect } from "react";
import { isNativeApp } from "../../../lib/nativeApp";

/** Dentro do app, o link público do perfil abre direto o perfil de verdade (com seguir e publicações). */
export default function OpenInApp({ path }) {
  useEffect(() => { if (isNativeApp()) window.location.replace(path); }, [path]);
  return null;
}
