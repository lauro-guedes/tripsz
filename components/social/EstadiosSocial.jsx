"use client";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Message, PrimaryBtn, SecondaryBtn, text } from "../convite/ConviteUi";
import { getFeed } from "../../lib/socialClient";
import { searchKey } from "../../lib/searchKey";
import { stadiumIdentity } from "../../lib/stadiumAlias";
import { supabaseBrowser } from "../../lib/supabase";
import { getVenuePhoto } from "../../lib/venuePhoto";
import TeamBadge from "../TeamBadge";
import { BORDER, FONT_DISPLAY, GREEN_DARK, MUTED, TEXT } from "../../lib/tokens";
import { PostList } from "./PostList";
import { EmptyState, SocialShell } from "./ui";

/** 70 -> "70 m"; 4200 -> "4,2 km" */
export const distLabel = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

/** "2026-11-02" ou "2026-11-02T20:45:00Z" -> "02/11/2026" */
export function dayLabel(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Agrupa os jogos que a pessoa já foi por estádio: mais jogos primeiro, empate pelo mais recente. Cada grupo traz os jogos do mais novo pro mais antigo. */
export function groupByStadium(games) {
  const by = new Map();
  for (const g of games || []) {
    const { key, label } = stadiumIdentity(g.stadium);
    if (!key) continue;
    // sem apelido conhecido, tira cidade colada no nome: "Estádio X (São Paulo, São Paulo)"
    const shown = label === g.stadium ? String(g.stadium).replace(/\s*\([^()]*,[^()]*\)\s*$/, "") : label;
    if (!by.has(key)) by.set(key, { key, name: shown, city: g.city || null, country: g.country || null, games: [] });
    by.get(key).games.push(g);
  }
  const date = (g) => String(g.match_date || "");
  const out = [...by.values()];
  for (const s of out) s.games.sort((a, b) => (date(a) < date(b) ? 1 : date(a) > date(b) ? -1 : 0));
  return out.sort((a, b) => b.games.length - a.games.length || (date(a.games[0]) < date(b.games[0]) ? 1 : -1));
}

function Photo({ name, city }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    getVenuePhoto(name, city).then((r) => alive && r && r.url && setUrl(r.url)).catch(() => {});
    return () => { alive = false; };
  }, [name, city]);
  return (
    <div style={{ height: 150, borderRadius: 12, overflow: "hidden", background: "linear-gradient(135deg,#0f172a,#14532d)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {url ? <img src={url} alt={name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <MapPin size={34} color="rgba(255,255,255,0.5)" />}
    </div>
  );
}

const TABS = [["meus", "Meus estádios"], ["hoje", "Na arquibancada"]];

/** Meus estádios: os estádios do meu Passaporte. O cartão abre a lista dos MEUS jogos naquele estádio. */
function MeusEstadios({ onNavigate }) {
  const [stadiums, setStadiums] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error: err } = await supabaseBrowser().from("attended_games").select("*").order("match_date", { ascending: false });
      if (!alive) return;
      if (err) { setError({ type: "error", text: "Não foi possível carregar seus estádios agora." }); return setStadiums([]); }
      setStadiums(groupByStadium(data || []));
    })();
    return () => { alive = false; };
  }, []);

  const needle = searchKey(query.slice(0, 80));
  const list = (stadiums || []).filter((s) => !needle || searchKey(`${s.name} ${s.city || ""}`).includes(needle));

  return (
    <div style={{ padding: "6px 16px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#eef2f6", borderRadius: 14, padding: "0 14px", display: "flex", gap: 10, alignItems: "center" }}>
        <Search size={18} color={MUTED} />
        <input aria-label="Buscar estádio ou cidade" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar estádio ou cidade..." style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "14px 0", fontSize: 14, fontFamily: FONT_DISPLAY }} />
      </div>
      <Message msg={error} />
      {!stadiums && <EmptyState title="Carregando seus estádios..." />}
      {stadiums && stadiums.length === 0 && !error && (
        <>
          <EmptyState title="Você ainda não registrou nenhum jogo" body="Registre um jogo a que você já foi e o estádio aparece aqui." />
          <PrimaryBtn onClick={() => onNavigate("registrar-jogo")}>Adicionar jogo passado</PrimaryBtn>
        </>
      )}
      {stadiums && stadiums.length > 0 && list.length === 0 && <EmptyState title="Nenhum estádio encontrado" body="Tente outro nome ou cidade." />}
      {list.map((s) => {
        const open = openKey === s.key;
        const last = dayLabel(s.games[0] && s.games[0].match_date);
        return (
          <div key={s.key} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div role="button" aria-expanded={open} aria-label={`Meus jogos em ${s.name}`} onClick={() => setOpenKey(open ? null : s.key)} style={{ display: "flex", flexDirection: "column", gap: 10, cursor: "pointer" }}>
              <Photo name={s.name} city={s.city} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, color: TEXT, margin: 0 }}>{s.name}</p>
                <ChevronDown size={20} color={MUTED} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none" }} />
              </div>
              <p style={text(13, MUTED)}>{[[s.city, s.country].filter(Boolean).join(", "), `${s.games.length} ${s.games.length === 1 ? "jogo" : "jogos"}`, last ? `último em ${last}` : null].filter(Boolean).join(" · ")}</p>
            </div>
            {open && (
              <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${BORDER}` }}>
                {s.games.map((g) => (
                  <div key={g.id} style={{ padding: "10px 0", borderBottom: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 2 }}>
                    {[[g.home_team, g.home_logo, g.home_score], [g.away_team, g.away_logo, g.away_score]].map(([team, logo, score], i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <TeamBadge name={team} url={logo} size={26} resolve />
                        <p style={{ ...text(14, TEXT, { fontWeight: 700 }), flex: 1, minWidth: 0 }}>{team}</p>
                        {score != null && <p style={text(14, TEXT, { fontWeight: 800 })}>{score}</p>}
                      </div>
                    ))}
                    <p style={text(12, MUTED)}>{[dayLabel(g.match_date), g.competition].filter(Boolean).join(" · ")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Na arquibancada: os check-ins das últimas 24 h (os públicos, os de quem eu sigo e os meus). */
function HojeCheckins({ onNavigate }) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState({ hasMore: false, cursor: null });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const load = useCallback(async (cursor) => {
    const r = await getFeed(cursor, "todos", "checkin");
    if (!r.ok) { setError({ type: "error", text: r.message }); return setStatus("ready"); }
    setError(null);
    setPosts((list) => (cursor ? [...list, ...r.posts] : r.posts));
    setPage({ hasMore: !!r.hasMore, cursor: r.nextCursor || null });
    setStatus("ready");
  }, []);
  useEffect(() => { load(null); }, [load]);

  return (
    <div style={{ padding: "6px 16px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={text(13, MUTED)}>Quem fez check-in em estádios nas últimas 24 horas.</p>
      <Message msg={error} />
      {status === "loading" && <EmptyState title="Procurando check-ins..." />}
      {status === "ready" && posts.length === 0 && !error && (
        <>
          <EmptyState title="A arquibancada está vazia" body="Ninguém fez check-in nas últimas 24 horas. Esteja num estádio e seja o primeiro." />
          <PrimaryBtn onClick={() => onNavigate("checkin")}>Fazer check-in</PrimaryBtn>
        </>
      )}
      <PostList posts={posts} setPosts={setPosts} onNavigate={onNavigate} />
      {page.hasMore && <SecondaryBtn onClick={() => load(page.cursor)}>Ver mais</SecondaryBtn>}
    </div>
  );
}

/** Estádios: os que eu já conheço (Meus estádios, com os meus jogos em cada um) e quem está na arquibancada (check-ins das últimas 24 h). */
export function EstadiosSocial({ onNavigate, onLogout, openPage = (path) => window.location.assign(path) }) {
  const [tab, setTab] = useState("meus");
  return (
    <SocialShell onNavigate={onNavigate} onLogout={onLogout}>
      <div style={{ padding: "18px 16px 8px" }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, color: TEXT, margin: 0 }}>Estádios</h1>
      </div>
      <div style={{ padding: "6px 16px" }}>
        <div role="tablist" aria-label="Estádios" style={{ display: "flex", background: "#eef2f6", borderRadius: 12, padding: 4, gap: 4 }}>
          {TABS.map(([id, label]) => (
            <div key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 9, cursor: "pointer", background: tab === id ? "#fff" : "transparent" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: tab === id ? GREEN_DARK : MUTED, margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
      {tab === "meus" ? <MeusEstadios onNavigate={onNavigate} /> : <HojeCheckins onNavigate={onNavigate} />}
      <div style={{ padding: "0 16px 28px" }}>
        <SecondaryBtn onClick={() => openPage("/estadios")}>Explorar todos os estádios</SecondaryBtn>
      </div>
    </SocialShell>
  );
}
