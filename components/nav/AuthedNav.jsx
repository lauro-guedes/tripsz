"use client";
import { supabaseBrowser } from "../../lib/supabase";
import { initials } from "../../lib/textUtils";
import { BORDER, FONT_DISPLAY, FONT_MONO, GOLD, GOLD_BG, GREEN, GREEN_BG, GREEN_BUTTON2, MUTED, TEXT } from "../../lib/tokens";
import { Icon } from "../ui/Icon";
import { Wordmark } from "../ui/Wordmark";
import { useIsMobile } from "../ui/useIsMobile";
import { useEffect, useRef, useState } from "react";

export function AvatarCircle({ url, name, size = 36, fontSize }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        src={url}
        alt={name || "avatar"}
        width={size}
        height={size}
        onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{ background: GREEN_BUTTON2, width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: fontSize || size * 0.4, color: "#fff", margin: 0 }}>{initials(name)}</p>
    </div>
  );
}

// Menu principal: 4 itens. "Meu calendário" e "Meu nível" são grupos que
// abrem a lista das telas deles. "Meu perfil" e "Minha assinatura" ficam no
// menu da conta (a foto, no canto).
export const NAV_MAIN = [
  { label: "Meus roteiros", key: "roteiros" },
  { label: "Meus jogos", key: "jogos" },
  { label: "Meu calendário", children: [["Calendário", "calendario"], ["Buscar jogos", "buscar"]] },
  { label: "Meu nível", children: [["Nível", "nivel"], ["Minhas conquistas", "conquistas"], ["Ranking", "ranking"]] },
];

export function AuthedNav({ active, userName, userAvatar, onNavigate, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null); // label do grupo com a lista aberta
  const closeTimer = useRef(null);
  const isMobile = useIsMobile();

  const groupActive = (it) => !!it.children && it.children.some(([, k]) => k === active);
  const itemActive = (it) => (it.children ? groupActive(it) : active === it.key);
  const go = (key) => {
    clearTimeout(closeTimer.current);
    setOpenGroup(null);
    setMenuOpen(false);
    onNavigate(key);
  };

  // Lembrete de confirmação de e-mail — não bloqueia nada, só avisa e
  // deixa reenviar o link de confirmação.
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [userEmailForBanner, setUserEmailForBanner] = useState("");
  const [resendStatus, setResendStatus] = useState("idle"); // idle | sending | sent
  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      setEmailConfirmed(!!data.user?.email_confirmed_at);
      setUserEmailForBanner(data.user?.email || "");
    })();
  }, []);
  const handleResendConfirmation = async () => {
    setResendStatus("sending");
    try {
      const supabase = supabaseBrowser();
      await supabase.auth.resend({ type: "signup", email: userEmailForBanner });
    } catch {
      // segue mesmo assim — não é crítico se falhar silenciosamente aqui
    } finally {
      setResendStatus("sent");
    }
  };

  const dropdownItem = (label, key) => (
    <div key={key} onClick={() => go(key)} style={{ padding: "10px 16px", cursor: "pointer", background: active === key ? GREEN_BG : "#fff" }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: active === key ? 700 : 500, fontSize: 13, color: active === key ? GREEN : TEXT, margin: 0, whiteSpace: "nowrap" }}>{label}</p>
    </div>
  );

  return (
    <div>
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 16px" : "24px 48px", position: "relative" }}>
        <div style={{ cursor: "pointer" }} onClick={() => go("roteiros")}><Wordmark /></div>
        {!isMobile && (
          <div style={{ display: "flex", gap: 36, alignItems: "center", fontFamily: FONT_DISPLAY, fontSize: 14 }}>
            {NAV_MAIN.map((it) => {
              const on = itemActive(it);
              const color = on ? GREEN : MUTED;
              if (!it.children) {
                return (
                  <p key={it.key} onClick={() => go(it.key)} style={{ color, fontWeight: on ? 700 : 500, margin: 0, cursor: "pointer", whiteSpace: "nowrap" }}>{it.label}</p>
                );
              }
              return (
                <div
                  key={it.label}
                  style={{ position: "relative" }}
                  onMouseEnter={() => { clearTimeout(closeTimer.current); setMenuOpen(false); setOpenGroup(it.label); }}
                  onMouseLeave={() => { closeTimer.current = setTimeout(() => setOpenGroup((g) => (g === it.label ? null : g)), 150); }}
                >
                  <div onClick={() => go(it.children[0][1])} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <p style={{ color, fontWeight: on ? 700 : 500, margin: 0, whiteSpace: "nowrap" }}>{it.label}</p>
                    <Icon name="chevronDown" size={14} color={color} />
                  </div>
                  {openGroup === it.label && (
                    <div style={{ position: "absolute", top: "100%", left: -16, paddingTop: 14, zIndex: 20 }}>
                      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.1)", minWidth: 190, overflow: "hidden" }}>
                        {it.children.map(([label, key]) => dropdownItem(label, key))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ position: "relative" }}>
          <div onClick={() => { setOpenGroup(null); setMenuOpen((v) => !v); }} style={{ background: "#fff", border: `1px solid ${BORDER}`, display: "flex", gap: 12, alignItems: "center", padding: "8px 12px 8px 8px", borderRadius: 999, cursor: "pointer" }}>
            <AvatarCircle url={userAvatar} name={userName} size={isMobile ? 28 : 36} fontSize={isMobile ? 12 : 14} />
            {!isMobile && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{userName || "Minha conta"}</p>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, margin: 0 }}>Área do usuário</p>
              </div>
            )}
            {isMobile && <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: TEXT, margin: 0 }}>{(userName || "Conta").split(" ")[0]}</p>}
            <Icon name="chevronDown" size={16} color={MUTED} />
          </div>
          {menuOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.1)", width: 200, overflow: "hidden", zIndex: 20 }}>
              {[["Meu perfil", "perfil"], ["Minha assinatura", "assinatura"]].map(([label, key]) => (
                <div key={key} onClick={() => go(key)} style={{ padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: active === key ? GREEN : TEXT, fontWeight: active === key ? 700 : 500, margin: 0 }}>{label}</p>
                </div>
              ))}
              <div onClick={() => { setMenuOpen(false); onLogout(); }} style={{ padding: "12px 16px", cursor: "pointer" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: "#dc2626", fontWeight: 700, margin: 0 }}>Sair</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {!emailConfirmed && (
        <div style={{ background: GOLD_BG, borderBottom: `1px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "10px 16px", flexWrap: "wrap" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: GOLD, margin: 0, textAlign: "center" }}>Confirme seu e-mail ({userEmailForBanner}) pra garantir o acesso à sua conta.</p>
          <p onClick={resendStatus === "sending" ? undefined : handleResendConfirmation} style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GOLD, textDecoration: "underline", margin: 0, cursor: resendStatus === "sending" ? "default" : "pointer" }}>
            {resendStatus === "sent" ? "E-mail reenviado ✓" : resendStatus === "sending" ? "Enviando..." : "Reenviar e-mail"}
          </p>
        </div>
      )}
      {isMobile && (
        <div>
          <div style={{ background: "#fff", borderBottom: openGroup ? "none" : `1px solid ${BORDER}`, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", alignItems: "stretch", gap: 4, padding: "6px 8px" }}>
            {NAV_MAIN.map((it) => {
              const on = itemActive(it);
              const open = openGroup === it.label;
              const color = on || open ? GREEN : "#63738c";
              return (
                <div
                  key={it.label}
                  onClick={() => (it.children ? setOpenGroup(open ? null : it.label) : go(it.key))}
                  style={{ background: on || open ? GREEN_BG : "transparent", padding: "8px 4px", borderRadius: 6, cursor: "pointer", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, textAlign: "center" }}
                >
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: on ? 700 : 500, fontSize: 12, lineHeight: 1.2, color, margin: 0 }}>{it.label}</p>
                  {it.children && <Icon name="chevronDown" size={12} color={color} style={{ transform: open ? "rotate(180deg)" : "none" }} />}
                </div>
              );
            })}
          </div>
          {openGroup && (
            <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "2px 8px 8px", display: "flex", flexDirection: "column" }}>
              {NAV_MAIN.find((it) => it.label === openGroup).children.map(([label, key]) => (
                <div key={key} onClick={() => go(key)} style={{ padding: "10px 12px", borderRadius: 6, cursor: "pointer", background: active === key ? GREEN_BG : "transparent" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: active === key ? 700 : 500, fontSize: 13, color: active === key ? GREEN : TEXT, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
