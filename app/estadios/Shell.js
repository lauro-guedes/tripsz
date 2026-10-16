import { BG, BORDER, GREEN, TEXT } from "../../lib/tokens";

export function Shell({ children }) {
  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "Inter, sans-serif", color: TEXT }}>
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 24px" }}>
        <a href="/" style={{ display: "inline-flex" }}>
          <img src="/logo-tripsz.svg" alt="tripsz" width={Math.round((123 / 34) * 30)} height={30} />
        </a>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="/estadios" style={{ color: TEXT, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Estádios</a>
          <a href="/" style={{ background: GREEN, color: "#fff", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}>Montar roteiro</a>
        </div>
      </div>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px 64px" }}>{children}</div>
    </div>
  );
}
