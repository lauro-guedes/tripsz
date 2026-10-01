"use client";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, Map, CalendarDays, CreditCard, Landmark, Trophy, Settings2, Search, HelpCircle, Bell, Download, Calendar as CalendarIcon } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";

const GREEN = "#00d66f";
const GREEN_BG = "#ddf9ea";
const BG = "#f4f7f6";
const BORDER = "#dee7e2";
const TEXT = "#102018";
const MUTED = "#53645b";
const MUTED_LIGHT = "#829087";
const SIDEBAR_BG = "#101b2d";
const SIDEBAR_ITEM_HOVER = "#233a35";
const SIDEBAR_TEXT = "#b9c4bf";
const BLUE = "#3178f6";

// Só essas duas telas já foram construídas — as outras aparecem no menu
// (fiéis ao Figma), mas desativadas até serem implementadas de verdade.
const NAV_ITEMS = [
  ["Visão Geral", LayoutDashboard, "overview", true],
  ["Usuários", Users, "users", true],
  ["Roteiros", Map, "trips", true],
  ["Consultorias", CalendarDays, "consulting", true],
  ["Assinaturas", CreditCard, "subscriptions", true],
  ["Financeiro", Landmark, "finance", true],
  ["Gamificação", Trophy, "gamification", true],
  ["Configurações", Settings2, "settings", false],
];

function IndicatorCard({ label, value, hint, growth }) {
  const hasGrowth = growth !== undefined && growth !== null;
  const isUp = hasGrowth && growth >= 0;
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 15, display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 180, minHeight: 106 }}>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0, width: "100%" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", width: "100%" }}>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 22, color: TEXT, margin: 0 }}>{value}</p>
        {hasGrowth && (
          <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 9, color: isUp ? "#008e4a" : "#d94b4b", margin: 0 }}>
            {isUp ? "↑" : "↓"} {Math.abs(growth).toLocaleString("pt-BR")}%
          </p>
        )}
      </div>
      {hint && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: MUTED_LIGHT, margin: 0, width: "100%" }}>{hint}</p>}
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
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 26, letterSpacing: "-0.5px", color: TEXT, margin: 0 }}>Visão geral</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: "5px 0 0" }}>Pulso da operação · {today}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 13px", height: 34, display: "flex", gap: 7, alignItems: "center", background: "#fff" }}>
            <CalendarIcon size={14} color={TEXT} />
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: TEXT, margin: 0 }}>Este mês</p>
          </div>
          <div style={{ border: `1px solid ${GREEN}`, borderRadius: 8, padding: "0 13px", height: 34, display: "flex", gap: 7, alignItems: "center", background: GREEN, cursor: "pointer" }}>
            <Download size={14} color={SIDEBAR_BG} />
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: SIDEBAR_BG, margin: 0 }}>Exportar relatório</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <IndicatorCard label="Usuários" value={data.totalUsers.toLocaleString("pt-BR")} />
        <IndicatorCard label="Assinantes ativos" value={data.activeSubscribers.toLocaleString("pt-BR")} />
        <IndicatorCard label="Roteiros (mês)" value={data.tripsThisMonth.toLocaleString("pt-BR")} />
        <IndicatorCard label="Jogos registrados (mês)" value={data.gamesThisMonth.toLocaleString("pt-BR")} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <IndicatorCard label="Receita recorrente" value={`R$ ${data.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="MRR líquido, assinaturas ativas" />
        <IndicatorCard label="Receita de consultorias" value={`R$ ${data.consultingRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="Total histórico, pedidos pagos" />
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: TEXT, margin: 0 }}>Crescimento de usuários</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED_LIGHT, margin: "3px 0 0" }}>Novos cadastros — últimos 14 dias</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 140, paddingTop: 10 }}>
          {data.newUsersByDay.map((d) => (
            <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ width: "100%", height: Math.max(4, (d.count / maxCount) * 100), background: GREEN, borderRadius: "4px 4px 1px 1px" }} title={`${d.date}: ${d.count}`} />
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
  const counts = { todos: users.length };
  statusOptions.slice(1).forEach((s) => { counts[s] = users.filter((u) => u.subscriptionStatus === s).length; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 26, letterSpacing: "-0.5px", color: TEXT, margin: 0 }}>Usuários</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: "5px 0 0" }}>Gestão da base e jornada dos torcedores</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <IndicatorCard label="Base total" value={users.length.toLocaleString("pt-BR")} />
        <IndicatorCard label="Assinantes ativos" value={counts["Ativo"] || 0} />
        <IndicatorCard label="Nunca assinaram" value={counts["Nunca assinou"] || 0} />
        <IndicatorCard label="Cancelados" value={counts["Cancelado"] || 0} />
      </div>

      <div style={{ borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 20 }}>
        {statusOptions.map((s) => (
          <div key={s} onClick={() => setFilter(s)} style={{ borderBottom: filter === s ? `2px solid #008e4a` : "2px solid transparent", paddingBottom: 10, paddingTop: 4, cursor: "pointer" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: filter === s ? 700 : 500, fontSize: 11, color: filter === s ? TEXT : MUTED_LIGHT, margin: 0 }}>{s === "todos" ? "Todos" : s} {counts[s] ?? ""}</p>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 10px", maxWidth: 320 }}>
        <Search size={14} color={MUTED_LIGHT} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" style={{ border: "none", outline: "none", background: "transparent", fontFamily: "Inter, sans-serif", fontSize: 11, flex: 1 }} />
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1.4fr 1fr 1.2fr", padding: "0 14px", height: 38, alignItems: "center", background: "#f8faf9" }}>
          {["Usuário", "País", "Criado em", "Nível", "Assinatura"].map((h) => (
            <p key={h} style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: MUTED_LIGHT, textTransform: "uppercase", letterSpacing: "0.3px", margin: 0 }}>{h}</p>
          ))}
        </div>
        {filtered.slice(0, 50).map((u, i) => (
          <div key={u.id} style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1.4fr 1fr 1.2fr", padding: "8px 14px", minHeight: 47, alignItems: "center", borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: i % 2 ? "#ddf9ea" : "#e8f0ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10, color: i % 2 ? "#008e4a" : BLUE, margin: 0 }}>{u.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</p>
              </div>
              <div>
                <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10, color: TEXT, margin: 0 }}>{u.name}</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 8, color: MUTED_LIGHT, margin: 0 }}>{u.email}</p>
              </div>
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{u.country || "—"}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{new Date(u.createdAt).toLocaleDateString("pt-BR")}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{u.level}</p>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 26, letterSpacing: "-0.5px", color: TEXT, margin: 0 }}>Assinaturas</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: "5px 0 0" }}>Planos, receita recorrente e ciclo de vida dos assinantes</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <IndicatorCard label="MRR" value={`R$ ${data.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        <IndicatorCard label="ARR projetado" value={`R$ ${(data.mrr * 12).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="MRR × 12" />
        <IndicatorCard label="Taxa de cancelamento" value={`${data.churnRate}%`} hint="Cancelados ÷ (ativos + cancelados)" />
        <IndicatorCard label="Assinantes ativos" value={data.activeCount} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: TEXT, margin: 0 }}>Mensal</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 20, color: TEXT, margin: 0 }}>{data.monthlyCount}</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: MUTED, margin: 0 }}>R$ 19,90/mês</p>
        </div>
        <div style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 10, padding: 14, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: TEXT, margin: 0 }}>Anual</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 20, color: TEXT, margin: 0 }}>{data.annualCount}</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: MUTED, margin: 0 }}>R$ 200,00/ano</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, height: 34, padding: "0 10px", fontFamily: "Inter, sans-serif", fontSize: 11, color: TEXT }}>
          <option value="todos">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="pending">Pendente</option>
          <option value="cancelled">Cancelado</option>
          <option value="paused">Pausado</option>
        </select>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1fr", padding: "0 14px", height: 38, alignItems: "center", background: "#f8faf9" }}>
          {["Assinante", "Plano", "Status", "Próxima cobrança", "Cartão"].map((h) => (
            <p key={h} style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: MUTED_LIGHT, textTransform: "uppercase", letterSpacing: "0.3px", margin: 0 }}>{h}</p>
          ))}
        </div>
        {filtered.slice(0, 50).map((s) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1fr", padding: "8px 14px", minHeight: 47, alignItems: "center", borderTop: `1px solid ${BORDER}` }}>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10, color: TEXT, margin: 0 }}>{s.userName}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 8, color: MUTED_LIGHT, margin: 0 }}>{s.userEmail}</p>
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{s.plan}</p>
            <StatusBadge label={statusLabels[s.status] || s.status} />
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString("pt-BR") : "—"}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{s.paymentMethod}</p>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 26, letterSpacing: "-0.5px", color: TEXT, margin: 0 }}>Consultorias e agendamentos</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: "5px 0 0" }}>{data.totalOrders} pedidos no total</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <IndicatorCard label="Receita total" value={`R$ ${data.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="Pedidos pagos" />
        <IndicatorCard label="Pagos" value={data.paidCount} />
        <IndicatorCard label="Pendentes" value={data.pendingCount} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, height: 34, padding: "0 10px", fontFamily: "Inter, sans-serif", fontSize: 11, color: TEXT }}>
          <option value="todos">Todos os status</option>
          <option value="paid">Pago</option>
          <option value="pending">Pendente</option>
        </select>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr 1fr", padding: "0 14px", height: 38, alignItems: "center", background: "#f8faf9" }}>
          {["Usuário", "Agendado para", "Status", "Valor"].map((h) => (
            <p key={h} style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: MUTED_LIGHT, textTransform: "uppercase", letterSpacing: "0.3px", margin: 0 }}>{h}</p>
          ))}
        </div>
        {filtered.slice(0, 50).map((o) => (
          <div key={o.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr 1fr", padding: "8px 14px", minHeight: 47, borderTop: `1px solid ${BORDER}`, alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10, color: TEXT, margin: 0 }}>{o.userName}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 8, color: MUTED_LIGHT, margin: 0 }}>{o.userEmail}</p>
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{o.scheduledDate ? `${new Date(o.scheduledDate).toLocaleDateString("pt-BR")} ${o.scheduledTime || ""}` : "—"}</p>
            <StatusBadge label={statusLabels[o.status] || o.status} />
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{`R$ ${o.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, padding: 24, textAlign: "center" }}>Nenhum pedido encontrado.</p>
        )}
      </div>
    </div>
  );
}

function TripsView({ email }) {
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/trips?email=${encodeURIComponent(email)}`);
        if (!res.ok) { setStatus("error"); return; }
        setData(await res.json());
        setStatus("ready");
      } catch { setStatus("error"); }
    })();
  }, [email]);

  if (status === "loading") return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Carregando...</p>;
  if (status === "error" || !data) return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Não foi possível carregar os roteiros.</p>;

  const filtered = data.trips.filter((t) => !search || t.userName.toLowerCase().includes(search.toLowerCase()) || t.userEmail.toLowerCase().includes(search.toLowerCase()));

  const countryCounts = {};
  data.trips.forEach((t) => t.countries.forEach((c) => { countryCounts[c] = (countryCounts[c] || 0) + 1; }));
  const topDestinations = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 26, letterSpacing: "-0.5px", color: TEXT, margin: 0 }}>Roteiros</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: "5px 0 0" }}>Geração e destinos escolhidos — o roteiro em si é sempre grátis</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <IndicatorCard label="Total de roteiros" value={data.total} />
        <IndicatorCard label="Com consultoria paga" value={data.withConsulting} />
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: TEXT, margin: 0 }}>Destinos mais escolhidos</p>
          {topDestinations.map(([country, count]) => (
            <div key={country} style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{country}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10, color: TEXT, margin: 0 }}>{count}</p>
            </div>
          ))}
          {topDestinations.length === 0 && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>Ainda sem dados suficientes.</p>}
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 10px", maxWidth: 320 }}>
        <Search size={14} color={MUTED_LIGHT} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" style={{ border: "none", outline: "none", background: "transparent", fontFamily: "Inter, sans-serif", fontSize: 11, flex: 1 }} />
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.6fr 1.4fr 1fr 1fr", padding: "0 14px", height: 38, alignItems: "center", background: "#f8faf9" }}>
          {["Usuário", "Países", "Datas", "Prioridade", "Criado em"].map((h) => (
            <p key={h} style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: MUTED_LIGHT, textTransform: "uppercase", letterSpacing: "0.3px", margin: 0 }}>{h}</p>
          ))}
        </div>
        {filtered.slice(0, 50).map((t) => (
          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.6fr 1.4fr 1fr 1fr", padding: "8px 14px", minHeight: 47, borderTop: `1px solid ${BORDER}`, alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10, color: TEXT, margin: 0 }}>{t.userName}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 8, color: MUTED_LIGHT, margin: 0 }}>{t.userEmail}</p>
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{t.countries.join(", ") || "—"}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{t.dateStart ? `${new Date(t.dateStart).toLocaleDateString("pt-BR")} – ${new Date(t.dateEnd).toLocaleDateString("pt-BR")}` : "—"}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{t.priority}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{new Date(t.createdAt).toLocaleDateString("pt-BR")}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, padding: 24, textAlign: "center" }}>Nenhum roteiro encontrado.</p>
        )}
      </div>
    </div>
  );
}

function GamificationView({ email }) {
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/gamification?email=${encodeURIComponent(email)}`);
        if (!res.ok) { setStatus("error"); return; }
        setData(await res.json());
        setStatus("ready");
      } catch { setStatus("error"); }
    })();
  }, [email]);

  if (status === "loading") return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Carregando...</p>;
  if (status === "error" || !data) return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Não foi possível carregar o ranking.</p>;

  const filtered = data.ranking.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 26, letterSpacing: "-0.5px", color: TEXT, margin: 0 }}>Gamificação</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: "5px 0 0" }}>Pontuação, conquistas e ranking da comunidade</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <IndicatorCard label="Torcedores no ranking" value={data.total} growth={data.membersGrowth} hint="vs. 30 dias atrás" />
        <IndicatorCard label="XP total distribuído" value={data.totalXp.toLocaleString("pt-BR")} growth={data.xpGrowth} hint="vs. 30 dias atrás" />
        <IndicatorCard label="Jogos registrados" value={data.totalGames.toLocaleString("pt-BR")} growth={data.gamesGrowth} hint="vs. 30 dias atrás" />
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: TEXT, margin: "0 0 4px" }}>Ranking da comunidade</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED_LIGHT, margin: "0 0 16px" }}>Top 3 por XP</p>
        {data.podium.length === 0 ? (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: MUTED }}>Ainda sem torcedores suficientes pro pódio.</p>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            {[data.podium[1], data.podium[0], data.podium[2]].map((p, i) => {
              if (!p) return <div key={i} style={{ flex: 1 }} />;
              const position = p === data.podium[0] ? 1 : p === data.podium[1] ? 2 : 3;
              const isFirst = position === 1;
              const heights = { 1: 112, 2: 88, 3: 74 };
              const initials = p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={p.userId} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: isFirst ? GREEN : "#e8f0ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 12, color: isFirst ? SIDEBAR_BG : BLUE, margin: 0 }}>{initials}</p>
                  </div>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: TEXT, margin: 0 }}>{p.name}</p>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 8, color: MUTED_LIGHT, margin: 0 }}>{p.xp.toLocaleString("pt-BR")} pts</p>
                  <div style={{ background: isFirst ? GREEN : "#ecf3ef", width: "100%", height: heights[position], borderRadius: "8px 8px 2px 2px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: 18, color: isFirst ? SIDEBAR_BG : MUTED, margin: 0 }}>{position}º</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: TEXT, margin: 0 }}>Confrontos mais registrados</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED_LIGHT, margin: "3px 0 0" }}>Todo o histórico</p>
          </div>
          {data.topMatchups.map(([matchup, count], i) => (
            <div key={matchup} style={{ display: "flex", gap: 9, alignItems: "center" }}>
              <div style={{ background: "#ecf3ef", borderRadius: 999, padding: "4px 8px" }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 9, color: MUTED, margin: 0 }}>{i + 1}</p>
              </div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0, flex: 1 }}>{matchup}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10, color: TEXT, margin: 0 }}>{count}</p>
            </div>
          ))}
          {data.topMatchups.length === 0 && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>Ainda sem dados suficientes.</p>}
        </div>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: TEXT, margin: 0 }}>Regras de pontuação</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED_LIGHT, margin: "3px 0 0" }}>Fórmula real usada no XP</p>
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            {[["Jogo registrado", "+50 pts"], ["Estádio novo", "+100 pts"], ["País novo", "+200 pts"], ["Badge completa", "+150 pts"]].map(([label, val]) => (
              <div key={label} style={{ background: "#f8faf9", borderRadius: 8, padding: 10, flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 8, color: MUTED, margin: 0 }}>{label}</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TEXT, margin: 0 }}>{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 10px", maxWidth: 320 }}>
        <Search size={14} color={MUTED_LIGHT} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" style={{ border: "none", outline: "none", background: "transparent", fontFamily: "Inter, sans-serif", fontSize: 11, flex: 1 }} />
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.8fr 1fr 1fr 0.8fr 0.8fr 0.8fr", padding: "0 14px", height: 38, alignItems: "center", background: "#f8faf9" }}>
          {["#", "Usuário", "País", "Nível", "XP", "Estádios", "Países"].map((h) => (
            <p key={h} style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: MUTED_LIGHT, textTransform: "uppercase", letterSpacing: "0.3px", margin: 0 }}>{h}</p>
          ))}
        </div>
        {filtered.slice(0, 50).map((r) => (
          <div key={r.userId} style={{ display: "grid", gridTemplateColumns: "0.6fr 1.8fr 1fr 1fr 0.8fr 0.8fr 0.8fr", padding: "8px 14px", minHeight: 47, borderTop: `1px solid ${BORDER}`, alignItems: "center" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10, color: MUTED_LIGHT, margin: 0 }}>#{r.position}</p>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10, color: TEXT, margin: 0 }}>{r.name}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 8, color: MUTED_LIGHT, margin: 0 }}>{r.email}</p>
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{r.country}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{r.tier}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10, color: GREEN, margin: 0 }}>{r.xp.toLocaleString("pt-BR")}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{r.stadiumsCount}</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED, margin: 0 }}>{r.countriesCount}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, padding: 24, textAlign: "center" }}>Nenhum torcedor encontrado.</p>
        )}
      </div>
    </div>
  );
}

function FinanceView({ email }) {
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/finance?email=${encodeURIComponent(email)}`);
        if (!res.ok) { setStatus("error"); return; }
        setData(await res.json());
        setStatus("ready");
      } catch { setStatus("error"); }
    })();
  }, [email]);

  if (status === "loading") return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Carregando...</p>;
  if (status === "error" || !data) return <p style={{ fontFamily: "Inter, sans-serif", color: MUTED }}>Não foi possível carregar os dados financeiros.</p>;

  const maxRevenue = Math.max(1, ...data.monthlyRevenue.map((m) => m.revenue));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22, color: TEXT, margin: 0 }}>Financeiro</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: MUTED, margin: "4px 0 0" }}>Resumo combinando assinaturas e consultorias.</p>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <IndicatorCard label="MRR" value={`R$ ${data.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="Receita recorrente mensal" />
        <IndicatorCard label="ARR" value={`R$ ${data.arr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="MRR × 12" />
        <IndicatorCard label="Receita de Consultorias" value={`R$ ${data.consultingRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} hint="Total histórico, pedidos pagos" />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <IndicatorCard label="Assinantes Ativos" value={data.activeSubscribers} />
        <IndicatorCard label="Assinantes Cancelados" value={data.cancelledSubscribers} />
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
        <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 15, color: TEXT, margin: "0 0 4px" }}>Receita — últimos 6 meses</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: MUTED, margin: "0 0 20px" }}>Aproximação a partir de quando cada assinatura/pedido foi criado — não é um histórico de faturamento oficial.</p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 140 }}>
          {data.monthlyRevenue.map((m) => (
            <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <p style={{ fontFamily: "monospace", fontSize: 10, color: MUTED, margin: 0 }}>{`R$ ${Math.round(m.revenue)}`}</p>
              <div style={{ width: "100%", height: Math.max(4, (m.revenue / maxRevenue) * 100), background: GREEN, borderRadius: 4 }} />
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: TEXT, textTransform: "capitalize", margin: 0 }}>{m.month}</p>
            </div>
          ))}
        </div>
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
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Acesso não autorizado</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: MUTED, margin: 0 }}>{userEmail ? `A conta ${userEmail} não tem acesso ao painel administrativo.` : "Você não está logado nesse navegador — entre com uma conta de administrador para continuar."}</p>
          {!userEmail && (
            <a href="/" style={{ background: GREEN, borderRadius: 8, padding: "10px 20px", textDecoration: "none" }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 13, color: "#fff", margin: 0 }}>Ir pra página de login</p>
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "Inter, sans-serif", display: "flex" }}>
      {/* Navegação lateral */}
      <div style={{ width: 232, background: SIDEBAR_BG, display: "flex", flexDirection: "column", gap: 22, padding: "24px 16px 20px", flexShrink: 0, minHeight: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <LayoutDashboard size={18} color={SIDEBAR_BG} />
          </div>
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 17, color: "#fff", margin: 0 }}>tripsz</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 9, color: GREEN, letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>Admin console</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 9, color: MUTED_LIGHT, letterSpacing: 1, textTransform: "uppercase", padding: "0 0 6px 10px", margin: 0 }}>Workspace</p>
          {NAV_ITEMS.map(([label, Icon, key, enabled]) => {
            const active = key === view;
            return (
              <div
                key={key}
                onClick={() => enabled && setView(key)}
                style={{ display: "flex", alignItems: "center", gap: 10, height: 38, padding: "0 11px", borderRadius: 8, background: active ? SIDEBAR_ITEM_HOVER : "transparent", cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.5 }}
              >
                <Icon size={16} color={active ? "#fff" : SIDEBAR_TEXT} />
                <p style={{ fontFamily: "Inter, sans-serif", fontWeight: active ? 700 : 500, fontSize: 12, color: active ? "#fff" : SIDEBAR_TEXT, margin: 0, flex: 1 }}>{label}</p>
                {active && <div style={{ width: 3, height: 18, borderRadius: 999, background: GREEN }} />}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          <div style={{ background: "#18283a", border: "1px solid #2b3b4b", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: GREEN }} />
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#fff", margin: 0 }}>Produção estável</p>
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: MUTED_LIGHT, margin: 0 }}>tripsz · painel administrativo</p>
          </div>
          <div style={{ borderTop: "1px solid #293647", paddingTop: 14, display: "flex", gap: 9, alignItems: "center" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 12, color: SIDEBAR_BG, margin: 0 }}>{(userEmail[0] || "A").toUpperCase()}</p>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#fff", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userEmail}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: MUTED_LIGHT, margin: 0 }}>Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Área principal */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Barra superior */}
        <div style={{ height: 64, borderBottom: `1px solid ${BORDER}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0 }}>
          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", width: 380 }}>
            <Search size={15} color={MUTED_LIGHT} />
            <input placeholder="Buscar usuário, roteiro, cobrança..." style={{ border: "none", outline: "none", background: "transparent", fontFamily: "Inter, sans-serif", fontSize: 11, flex: 1, color: TEXT }} />
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: MUTED_LIGHT, margin: 0 }}>⌘ K</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <HelpCircle size={16} color={MUTED} />
            </div>
            <Bell size={18} color={MUTED} />
            <div style={{ width: 1, height: 24, background: BORDER }} />
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: GREEN, margin: 0 }}>BR · Produção</p>
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ padding: "24px 28px 36px", overflowY: "auto" }}>
          {view === "overview" && <OverviewView email={userEmail} />}
          {view === "users" && <UsersView email={userEmail} />}
          {view === "subscriptions" && <SubscriptionsView email={userEmail} />}
          {view === "consulting" && <ConsultingView email={userEmail} />}
          {view === "trips" && <TripsView email={userEmail} />}
          {view === "gamification" && <GamificationView email={userEmail} />}
          {view === "finance" && <FinanceView email={userEmail} />}
        </div>
      </div>
    </div>
  );
}
