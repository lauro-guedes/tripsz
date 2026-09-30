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

// Só essas duas telas já foram construídas — as outras aparecem no menu
// (fiéis ao Figma), mas desativadas até serem implementadas de verdade.
const NAV_ITEMS = [
  ["Visão Geral", LayoutDashboard, "overview", true],
  ["Usuários", Users, "users", true],
  ["Roteiros", Map, "trips", false],
  ["Consultorias", CalendarDays, "consulting", true],
  ["Assinaturas", CreditCard, "subscriptions", true],
  ["Financeiro", Landmark, "finance", false],
  ["Gamificação", Trophy, "gamification", false],
  ["Configurações", Settings2, "settings", false],
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

function StatusBadge({ label }) {
  const colors = {
    "Ativo": { bg: "rgba(0,200,83,0.08)", text: GREEN },
    "Cancelado": { bg: "rgba(239,68,68,0.08)", text: "#ef4444" },
    "Pendente": { bg: "rgba(234,179,8,0.1)", text: "#b48200" },
    "Legado (grátis)": { bg: "rgba(100,116,139,0.1)", text: MUTED },
    "Nunca assinou": { bg: "rgba(100,116,139,0.08)", text: MUTED },
    "Pausado": { bg: "rgba(234,179,8,0.1)", text: "#b48200" },
    "Pago": { bg: "rgba(0,200,83,0.08)", text: GREEN },
  };
  const c = colors[label] || colors["Nunca assinou"];
  return (
    <div style={{ background: c.bg, display: "inline-flex", padding: "4px 10px", borderRadius: 4 }}>
      <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 11, color: c.text, margin: 0 }}>{label.toUpperCase()}</p>
    </div>
  );
}

function OverviewView({ email }) {
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/overview?email=${encodeURIComponent(email)}`);
        if (!res.ok) { setStatus("error"); return; }
        setData(await res.json());
        setStatus("ready");
      } catch { setStatus("error"); }
    })();
  }, [email]);

  if (status === "loading") return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Carregando...</p>;
  if (status === "error" || !data) return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Não foi possível carregar os dados.</p>;

  const maxCount = Math.max(1, ...data.newUsersByDay.map((d) => d.count));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
    </div>
  );
}

function UsersView({ email }) {
  const [status, setStatus] = useState("loading");
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`);
        if (!res.ok) { setStatus("error"); return; }
        const data = await res.json();
        setUsers(data.users || []);
        setStatus("ready");
      } catch { setStatus("error"); }
    })();
  }, [email]);

  if (status === "loading") return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Carregando...</p>;
  if (status === "error") return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Não foi possível carregar os usuários.</p>;

  const filtered = users.filter((u) => {
    const matchesFilter = filter === "todos" || u.subscriptionStatus === filter;
    const matchesSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statusOptions = ["todos", "Ativo", "Cancelado", "Pendente", "Legado (grátis)", "Nunca assinou"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22, color: TEXT, margin: 0 }}>Usuários</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, margin: "4px 0 0" }}>{filtered.length} de {users.length} usuários</p>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", flex: 1, maxWidth: 320 }}>
          <Search size={16} color={MUTED} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." style={{ border: "none", outline: "none", background: "transparent", fontFamily: "Inter, sans-serif", fontSize: 13, flex: 1 }} />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT }}>
          {statusOptions.map((s) => <option key={s} value={s}>{s === "todos" ? "Todos os status" : s}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1fr 1.2fr", padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
          {["Usuário", "País", "Criado em", "Nível", "Assinatura"].map((h) => (
            <p key={h} style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>{h}</p>
          ))}
        </div>
        {filtered.slice(0, 50).map((u) => (
          <div key={u.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1fr 1.2fr", padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{u.name}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: 0 }}>{u.email}</p>
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>{u.country || "—"}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>{new Date(u.createdAt).toLocaleDateString("pt-BR")}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>{u.level}</p>
            <StatusBadge label={u.subscriptionStatus} />
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, padding: 24, textAlign: "center" }}>Nenhum usuário encontrado.</p>
        )}
      </div>
      {filtered.length > 50 && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, textAlign: "center", margin: 0 }}>Mostrando os 50 primeiros — refine a busca pra ver outros.</p>
      )}
    </div>
  );
}

function SubscriptionsView({ email }) {
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("todos");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/subscriptions?email=${encodeURIComponent(email)}`);
        if (!res.ok) { setStatus("error"); return; }
        setData(await res.json());
        setStatus("ready");
      } catch { setStatus("error"); }
    })();
  }, [email]);

  if (status === "loading") return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Carregando...</p>;
  if (status === "error" || !data) return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Não foi possível carregar as assinaturas.</p>;

  const statusLabels = { active: "Ativo", pending: "Pendente", cancelled: "Cancelado", paused: "Pausado" };
  const filtered = data.subscriptions.filter((s) => filter === "todos" || s.status === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22, color: TEXT, margin: 0 }}>Assinaturas</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, margin: "4px 0 0" }}>{data.subscriptions.length} assinaturas no total.</p>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <IndicatorCard label="MRR" value={`R$ ${data.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="Receita recorrente mensal" />
        <IndicatorCard label="Taxa de Cancelamento" value={`${data.churnRate}%`} hint="Cancelados ÷ (ativos + cancelados)" />
        <IndicatorCard label="Plano Mensal" value={data.monthlyCount} hint="Assinantes ativos" />
        <IndicatorCard label="Plano Anual" value={data.annualCount} hint="Assinantes ativos" />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT }}>
          <option value="todos">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="pending">Pendente</option>
          <option value="cancelled">Cancelado</option>
          <option value="paused">Pausado</option>
        </select>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1fr", padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
          {["Usuário", "Plano", "Status", "Próxima Cobrança", "Cartão"].map((h) => (
            <p key={h} style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>{h}</p>
          ))}
        </div>
        {filtered.slice(0, 50).map((s) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1fr", padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{s.userName}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: 0 }}>{s.userEmail}</p>
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>{s.plan}</p>
            <StatusBadge label={statusLabels[s.status] || s.status} />
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString("pt-BR") : "—"}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>{s.paymentMethod}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, padding: 24, textAlign: "center" }}>Nenhuma assinatura encontrada.</p>
        )}
      </div>
    </div>
  );
}

function ConsultingView({ email }) {
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("todos");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/consulting?email=${encodeURIComponent(email)}`);
        if (!res.ok) { setStatus("error"); return; }
        setData(await res.json());
        setStatus("ready");
      } catch { setStatus("error"); }
    })();
  }, [email]);

  if (status === "loading") return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Carregando...</p>;
  if (status === "error" || !data) return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Não foi possível carregar as consultorias.</p>;

  const statusLabels = { paid: "Pago", pending: "Pendente" };
  const filtered = data.orders.filter((o) => filter === "todos" || o.status === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22, color: TEXT, margin: 0 }}>Consultorias</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, margin: "4px 0 0" }}>{data.totalOrders} pedidos no total.</p>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <IndicatorCard label="Receita Total" value={`R$ ${data.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="Pedidos pagos" />
        <IndicatorCard label="Pagos" value={data.paidCount} />
        <IndicatorCard label="Pendentes" value={data.pendingCount} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT }}>
          <option value="todos">Todos os status</option>
          <option value="paid">Pago</option>
          <option value="pending">Pendente</option>
        </select>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr 1fr", padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
          {["Usuário", "Agendado para", "Status", "Valor"].map((h) => (
            <p key={h} style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>{h}</p>
          ))}
        </div>
        {filtered.slice(0, 50).map((o) => (
          <div key={o.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr 1fr", padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{o.userName}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: 0 }}>{o.userEmail}</p>
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>{o.scheduledDate ? `${new Date(o.scheduledDate).toLocaleDateString("pt-BR")} ${o.scheduledTime || ""}` : "—"}</p>
            <StatusBadge label={statusLabels[o.status] || o.status} />
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>{`R$ ${o.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, padding: 24, textAlign: "center" }}>Nenhum pedido encontrado.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [status, setStatus] = useState("loading"); // loading | denied | ready
  const [userEmail, setUserEmail] = useState("");
  const [view, setView] = useState("overview");

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      setUserEmail(email || "");
      if (!email) { setStatus("denied"); return; }
      try {
        const res = await fetch(`/api/admin/overview?email=${encodeURIComponent(email)}`);
        setStatus(res.ok ? "ready" : "denied");
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
          {NAV_ITEMS.map(([label, Icon, key, enabled]) => {
            const active = key === view;
            return (
              <div
                key={key}
                onClick={() => enabled && setView(key)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: active ? GREEN_BG : "transparent", cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.5 }}
              >
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
        <div style={{ padding: 24, overflowY: "auto" }}>
          {view === "overview" && <OverviewView email={userEmail} />}
          {view === "users" && <UsersView email={userEmail} />}
          {view === "subscriptions" && <SubscriptionsView email={userEmail} />}
          {view === "consulting" && <ConsultingView email={userEmail} />}
        </div>
      </div>
    </div>
  );
}
