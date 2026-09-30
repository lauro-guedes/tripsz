"use client";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, Map, CalendarDays, CreditCard, Landmark, Trophy, Settings2, Search, HelpCircle, Bell, Download, Calendar as CalendarIcon } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";

const GREEN = "#00c853";
const GREEN_BG = "rgba(0,200,83,0.06)";
const BG = "#f8fafc";
const BORDER = "#e2e8f0";
const TEXT = "#0f172a";
const MUTED = "#64748b";

const NAV_ITEMS = [
  ["Visão Geral", LayoutDashboard, "overview"],
  ["Usuários", Users, "users"],
  ["Roteiros", Map, "trips"],
  ["Consultorias", CalendarDays, "consulting"],
  ["Assinaturas", CreditCard, "subscriptions"],
  ["Financeiro", Landmark, "finance"],
  ["Gamificação", Trophy, "gamification"],
  ["Configurações", Settings2, "settings"],
];

function IndicatorCard({ label, value, hint }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 180 }}>
      <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>{label}</p>
      <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 28, color: TEXT, margin: 0 }}>{value}</p>
      {hint && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: 0 }}>{hint}</p>}
    </div>
  );
}

export default function AdminPage() {
  const [status, setStatus] = useState("loading"); // loading | denied | ready
  const [data, setData] = useState(null);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      setUserEmail(email || "");
      if (!email) {
        setStatus("denied");
        return;
      }
      try {
        const res = await fetch(`/api/admin/overview?email=${encodeURIComponent(email)}`);
        if (!res.ok) {
          setStatus("denied");
          return;
        }
        const json = await res.json();
        setData(json);
        setStatus("ready");
      } catch {
        setStatus("denied");
      }
    })();
  }, []);

  if (status === "loading") {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Carregando...</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Acesso não autorizado</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: MUTED, margin: 0 }}>{userEmail ? `A conta ${userEmail} não tem acesso ao painel administrativo.` : "Entre com uma conta de administrador para continuar."}</p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(1, ...data.newUsersByDay.map((d) => d.count));

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "Inter, sans-serif", display: "flex" }}>
      {/* Navegação lateral */}
      <div style={{ width: 232, background: "#fff", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", padding: "24px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 32 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: GREEN_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LayoutDashboard size={18} color={GREEN} />
          </div>
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 15, color: TEXT, margin: 0 }}>tripsz</p>
            <p style={{ fontFamily: "monospace", fontSize: 10, color: MUTED, margin: 0 }}>Painel Admin</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map(([label, Icon, key]) => {
            const active = key === "overview";
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: active ? GREEN_BG : "transparent", cursor: active ? "default" : "not-allowed", opacity: active ? 1 : 0.5 }}>
                <Icon size={16} color={active ? GREEN : MUTED} />
                <p style={{ fontFamily: "Inter, sans-serif", fontWeight: active ? 700 : 500, fontSize: 14, color: active ? GREEN : TEXT, margin: 0 }}>{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Área principal */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Barra superior */}
        <div style={{ height: 64, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", width: 280 }}>
            <Search size={16} color={MUTED} />
            <input placeholder="Buscar..." style={{ border: "none", outline: "none", background: "transparent", fontFamily: "Inter, sans-serif", fontSize: 13, flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <HelpCircle size={18} color={MUTED} />
            <Bell size={18} color={MUTED} />
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22, color: TEXT, margin: 0 }}>Visão Geral</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, margin: "4px 0 0" }}>Números em tempo real, direto do banco.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 14px", display: "flex", gap: 6, alignItems: "center", background: "#fff" }}>
                <CalendarIcon size={14} color={MUTED} />
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>Este mês</p>
              </div>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 14px", display: "flex", gap: 6, alignItems: "center", background: "#fff", cursor: "pointer" }}>
                <Download size={14} color={MUTED} />
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>Exportar</p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <IndicatorCard label="Total de Usuários" value={data.totalUsers.toLocaleString("pt-BR")} />
            <IndicatorCard label="Assinantes Ativos" value={data.activeSubscribers.toLocaleString("pt-BR")} />
            <IndicatorCard label="Roteiros (mês)" value={data.tripsThisMonth.toLocaleString("pt-BR")} />
            <IndicatorCard label="Jogos Registrados (mês)" value={data.gamesThisMonth.toLocaleString("pt-BR")} />
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <IndicatorCard label="MRR (Receita Recorrente)" value={`R$ ${data.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="Soma das assinaturas ativas" />
            <IndicatorCard label="Receita de Consultorias" value={`R$ ${data.consultingRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="Pedidos pagos, total histórico" />
          </div>

          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 15, color: TEXT, margin: "0 0 20px" }}>Novos usuários — últimos 14 dias</p>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 120 }}>
              {data.newUsersByDay.map((d) => (
                <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: Math.max(4, (d.count / maxCount) * 100), background: d.count > 0 ? GREEN : BORDER, borderRadius: 4 }} title={`${d.date}: ${d.count}`} />
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, textAlign: "center", margin: 0 }}>
            Essa é a primeira tela do painel administrativo — as outras 7 (destacadas com opacidade reduzida no menu) ainda não foram construídas.
          </p>
        </div>
      </div>
    </div>
  );
}
