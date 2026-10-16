"use client";
import { useEffect, useState } from "react";

/** Foto do estádio: se o servidor ainda não tinha, busca no navegador (a Wikipedia pode demorar) — a página não espera por ela. */
export function StadiumPhoto({ name, city, alt, border, muted }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/venues/photo?name=${encodeURIComponent(name)}&city=${encodeURIComponent(city || "")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.url) setInfo(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, [name, city]);
  if (!info) return null;
  return (
    <figure style={{ margin: "0 0 24px" }}>
      <img src={info.url} alt={alt} style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 12, border: `1px solid ${border}` }} />
      {info.source && <figcaption style={{ fontSize: 12, color: muted, marginTop: 6 }}>Foto: {info.source}</figcaption>}
    </figure>
  );
}
