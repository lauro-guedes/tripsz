"use client";
import { checkPassportAccess } from "../../lib/passportAccess";
import { supabaseBrowser } from "../../lib/supabase";
import { teamLabel } from "../../lib/textUtils";
import { BG, BG_ALT, BODY, BORDER, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, GREEN_BG, GREEN_BUTTON, MUTED, TEXT } from "../../lib/tokens";
import TeamBadge from "../TeamBadge";
import { PHOTO_STADIUM } from "../landing/LandingPage";
import { AuthedFooter } from "../nav/AuthedFooter";
import { AuthedNav, AvatarCircle } from "../nav/AuthedNav";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";
import { Loading } from "../ui/Loading";
import { UnsavedChangesModal } from "../ui/UnsavedChangesModal";
import { useIsMobile } from "../ui/useIsMobile";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

export const COUNTRY_LIST = [
  "Brasil",
  "Alemanha", "Angola", "Argentina", "Austrália", "Áustria",
  "Bélgica", "Bolívia", "Canadá", "Chile", "China", "Colômbia",
  "Coreia do Sul", "Costa Rica", "Croácia", "Cuba", "Dinamarca",
  "Egito", "Equador", "Escócia", "Espanha", "Estados Unidos",
  "França", "Grécia", "Holanda", "Hungria", "Índia", "Inglaterra",
  "Irlanda", "Islândia", "Itália", "Japão", "México", "Marrocos",
  "Moçambique", "Noruega", "Nova Zelândia", "Panamá", "Paraguai",
  "Peru", "Polônia", "Portugal", "Reino Unido", "República Tcheca",
  "Rússia", "Senegal", "Sérvia", "Suécia", "Suíça", "Turquia",
  "Ucrânia", "Uruguai", "Venezuela",
];

export function MeuPerfil({ onNavigate, onLogout }) {
  const isMobile = useIsMobile();
  const PREFS = [
    ["derbies", "Derbies Locais & Clássicos Extremos"],
    ["estadios", "Estádios Históricos / Museus"],
    ["grandes", "Ligas Grandes (Premier / Champions)"],
    ["alternativo", "Futebol Alternativo / Ligas Menores"],
  ];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [favoriteTeams, setFavoriteTeams] = useState([]);
  const [teamQuery, setTeamQuery] = useState("");
  const [teamSuggestions, setTeamSuggestions] = useState([]);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [prefs, setPrefs] = useState([]);
  const [original, setOriginal] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [subAccess, setSubAccess] = useState(null);

  const loadProfile = async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      // Sessão expirada — manda pra Landing em vez de travar a tela
      // pra sempre num "Carregando..." que nunca termina.
      setLoading(false);
      onLogout();
      return;
    }
    const loaded = {
      name: user.user_metadata?.name || "",
      email: user.email || "",
      whatsapp: user.user_metadata?.whatsapp || "",
      country: user.user_metadata?.country || "",
      favoriteTeams: user.user_metadata?.favorite_teams || [],
      prefs: user.user_metadata?.preferences || [],
    };
    setName(loaded.name);
    setEmail(loaded.email);
    setWhatsapp(loaded.whatsapp);
    setCountry(loaded.country);
    setFavoriteTeams(loaded.favoriteTeams);
    setPrefs(loaded.prefs);
    setAvatarUrl(user.user_metadata?.avatar_url || null);
    setOriginal(loaded);
    setLoading(false);
    setSubAccess(await checkPassportAccess());
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (teamQuery.trim().length < 3) {
      setTeamSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teams/suggest?q=${encodeURIComponent(teamQuery)}`);
        const data = await res.json();
        setTeamSuggestions(data.suggestions || []);
        setShowTeamDropdown(true);
      } catch {
        setTeamSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [teamQuery]);

  const addFavoriteTeam = (name) => {
    if (!favoriteTeams.includes(name)) setFavoriteTeams((t) => [...t, name]);
    setTeamQuery("");
    setShowTeamDropdown(false);
  };
  const removeFavoriteTeam = (name) => setFavoriteTeams((t) => t.filter((x) => x !== name));

  const togglePref = (id) => setPrefs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;
    setAvatarError(null);

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setAvatarError("Envie um arquivo JPG ou PNG.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setAvatarError("A imagem precisa ter no máximo 1MB.");
      return;
    }

    setAvatarUploading(true);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");

      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // Acrescenta um carimbo de tempo pra forçar o navegador a buscar a
      // imagem nova, já que o caminho do arquivo é sempre o mesmo.
      const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: freshUrl } });
      if (updateError) throw updateError;

      setAvatarUrl(freshUrl);
    } catch (err) {
      setAvatarError(err.message || "Não foi possível enviar a foto.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDiscard = () => {
    if (!original) return;
    setName(original.name);
    setEmail(original.email);
    setWhatsapp(original.whatsapp);
    setCountry(original.country);
    setFavoriteTeams(original.favoriteTeams || []);
    setPrefs(original.prefs);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    if (newPassword || confirmPassword) {
      const passwordError = !currentPassword
        ? "Digite sua senha atual para definir uma nova senha."
        : newPassword.length < 8
          ? "A nova senha precisa ter no mínimo 8 caracteres."
          : newPassword !== confirmPassword
            ? "As senhas não coincidem."
            : null;
      if (passwordError) {
        setError(passwordError);
        return false;
      }
    }

    setSaving(true);
    try {
      const supabase = supabaseBrowser();

      // Trocar de senha exige confirmar a senha atual primeiro — o Supabase
      // não faz essa checagem sozinho, então reautenticamos antes de aplicar.
      if (newPassword) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({ email: original.email, password: currentPassword });
        if (reauthError) throw new Error("Senha atual incorreta.");
      }

      const updates = { data: { name, whatsapp, country, favorite_teams: favoriteTeams, preferences: prefs } };
      if (email !== original.email) updates.email = email;
      if (newPassword) updates.password = newPassword;

      const { error: updateError } = await supabase.auth.updateUser(updates);
      if (updateError) throw updateError;

      setOriginal({ name, email, whatsapp, country, favoriteTeams, prefs });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = { width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, outline: "none" };
  const px = isMobile ? "16px" : "80px";

  // Há alterações que ainda não foram salvas? (usado pelos botões e pelo aviso ao sair)
  const sameArray = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));
  const hasChanges = !!original && (
    name !== original.name ||
    email !== original.email ||
    whatsapp !== original.whatsapp ||
    country !== original.country ||
    !sameArray(favoriteTeams, original.favoriteTeams) ||
    !sameArray(prefs, original.prefs) ||
    !!currentPassword || !!newPassword || !!confirmPassword
  );

  // Aviso pra pessoa não esquecer de salvar: qualquer saída desta tela (menu, sair da
  // conta, links internos) pergunta antes se houver alterações; fechar a aba ou
  // recarregar a página usa o aviso do próprio navegador.
  const [pendingLeave, setPendingLeave] = useState(null); // a ação de sair que ficou esperando a resposta
  const requestLeave = (go) => {
    if (hasChanges) setPendingLeave(() => go);
    else go();
  };
  const guardedNavigate = (key) => requestLeave(() => onNavigate(key));
  const guardedLogout = () => requestLeave(() => onLogout());
  useEffect(() => {
    if (!hasChanges) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges]);

  return (
    <div style={{ background: BG, width: "100%" }}>
      <AuthedNav active="perfil" userName={name} userAvatar={avatarUrl} onNavigate={guardedNavigate} onLogout={guardedLogout} />
      {pendingLeave && (
        <UnsavedChangesModal
          saving={saving}
          error={error}
          onStay={() => setPendingLeave(null)}
          onDiscard={() => {
            const go = pendingLeave;
            setPendingLeave(null);
            go();
          }}
          onSave={async () => {
            const saved = await handleSave();
            if (saved) {
              const go = pendingLeave;
              setPendingLeave(null);
              go();
            }
          }}
        />
      )}

      <div style={{ position: "relative", display: "flex", alignItems: "center", padding: isMobile ? `32px ${px}` : `48px ${px}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={PHOTO_STADIUM} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)" }} />
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
          <Badge>Configurações de Conta</Badge>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 28 : 48, color: TEXT, margin: 0 }}>Seu Perfil de Viajante</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 18, lineHeight: 1.5, color: BODY, margin: 0, maxWidth: 700 }}>Gerencie suas informações cadastrais, canais de contato, preferências de torcedor e segurança de acesso à sua conta Tripsz.</p>
        </div>
      </div>

      {loading ? (
        <Loading text="Carregando seu perfil..." />
      ) : (
        <div style={{ background: BG_ALT, display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 24 : 48, padding: isMobile ? `0 ${px} 32px` : `0 ${px} 48px` }}>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 32, display: "flex", flexDirection: "column", gap: 32, flex: 1 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: TEXT, margin: 0 }}>Dados Cadastrais</p>

            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ width: 100, height: 100, borderRadius: 50, border: `2px solid ${GREEN}`, overflow: "hidden", flexShrink: 0 }}>
                <AvatarCircle url={avatarUrl} name={name} size={100} fontSize={32} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ background: GREEN_BUTTON, opacity: avatarUploading ? 0.6 : 1, padding: "8px 16px", borderRadius: 6, cursor: avatarUploading ? "default" : "pointer", display: "inline-block" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff", margin: 0 }}>{avatarUploading ? "Enviando..." : "Alterar foto"}</p>
                  <input type="file" accept="image/jpeg,image/png" onChange={handleAvatarChange} disabled={avatarUploading} style={{ display: "none" }} />
                </label>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>JPG ou PNG. Máximo de 1MB</p>
                {avatarError && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#dc2626", margin: 0 }}>{avatarError}</p>}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nome Completo</p>
                <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
              </div>
              <div style={{ display: "flex", gap: 20, flexDirection: isMobile ? "column" : "row" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>E-mail</p>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>WhatsApp</p>
                  <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} style={fieldStyle} />
                </div>
              </div>
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, maxWidth: isMobile ? "100%" : "calc(50% - 10px)" }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>País</p>
                <input
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setShowCountryDropdown(true); }}
                  onFocus={() => setShowCountryDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCountryDropdown(false), 150)}
                  placeholder="Digite ou escolha seu país"
                  style={fieldStyle}
                />
                {showCountryDropdown && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", maxHeight: 220, overflowY: "auto", zIndex: 20 }}>
                    {COUNTRY_LIST.filter((c) => c.toLowerCase().includes(country.toLowerCase())).map((c) => (
                      <div
                        key={c}
                        onMouseDown={() => { setCountry(c); setShowCountryDropdown(false); }}
                        style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                      >
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: TEXT, margin: 0 }}>{c}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Meus Times Favoritos</p>
              <div style={{ position: "relative" }}>
                <input
                  value={teamQuery}
                  onChange={(e) => setTeamQuery(e.target.value)}
                  onFocus={() => teamSuggestions.length > 0 && setShowTeamDropdown(true)}
                  onBlur={() => setTimeout(() => setShowTeamDropdown(false), 150)}
                  placeholder="Busque um clube ou seleção pra adicionar"
                  style={fieldStyle}
                />
                {showTeamDropdown && teamSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0px 8px 16px rgba(15,23,42,0.12)", maxHeight: 220, overflowY: "auto", zIndex: 20 }}>
                    {teamSuggestions.map((s) => (
                      <div
                        key={s.name}
                        onMouseDown={() => addFavoriteTeam(s.name)}
                        style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                      >
                        <TeamBadge name={s.name} url={s.logo} size={22} />
                        <div>
                          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{teamLabel(s.name)}</p>
                          {s.country && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: MUTED, margin: 0 }}>{s.country}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {favoriteTeams.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {favoriteTeams.map((team) => (
                    <div key={team} onClick={() => removeFavoriteTeam(team)} style={{ background: GREEN_BG, border: `1px solid ${GREEN}`, borderRadius: 999, padding: "6px 12px", display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>{teamLabel(team)}</p>
                      <X size={12} color={GREEN} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ height: 1, background: BORDER, width: "100%" }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Segurança</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Senha Atual</p>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Preencha só se for trocar a senha" style={fieldStyle} />
              </div>
              <div style={{ display: "flex", gap: 20, flexDirection: isMobile ? "column" : "row" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Nova Senha</p>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" style={fieldStyle} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Confirmar Nova Senha</p>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" style={fieldStyle} />
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: BORDER, width: "100%" }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Preferências de Viagem</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
              <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Estilo de Roteiro Favorito</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {PREFS.map(([id, label]) => {
                  const active = prefs.includes(id);
                  return (
                    <div key={id} onClick={() => togglePref(id)} style={{ background: active ? GREEN_BG : BG_ALT, border: active ? `1.5px solid ${GREEN}` : "1.5px solid transparent", padding: "8px 16px", borderRadius: 999, cursor: "pointer" }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: active ? 700 : 400, fontSize: 13, color: active ? GREEN : BODY, margin: 0 }}>{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
            {success && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: GREEN, margin: 0 }}>Alterações salvas com sucesso!</p>}

            {(() => {
              const canSave = hasChanges && !saving;
              return (
                <div style={{ display: "flex", gap: 16, justifyContent: "flex-end", width: "100%" }}>
                  <div onClick={hasChanges ? handleDiscard : undefined} style={{ background: BG_ALT, padding: "14px 24px", borderRadius: 8, cursor: hasChanges ? "pointer" : "default", opacity: hasChanges ? 1 : 0.5 }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: MUTED, margin: 0 }}>Descartar</p>
                  </div>
                  <div onClick={canSave ? handleSave : undefined} style={{ background: GREEN_BUTTON, opacity: canSave ? 1 : 0.5, padding: "14px 28px", borderRadius: 8, cursor: canSave ? "pointer" : "default" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>{saving ? "Salvando..." : "Salvar Alterações"}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{ width: isMobile ? "100%" : 380 }}>
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: TEXT, margin: 0 }}>Status da Conta</p>
              <div style={{ background: "#fff9e6", border: "1px solid #b78103", borderRadius: 8, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <AlertTriangle size={20} color="#b78103" />
                <div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#b78103", margin: 0 }}>Membro Tripsz</p>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: "#b78103", margin: 0 }}>Conta ativa</p>
                </div>
              </div>
              {subAccess?.subscription?.status === "active" ? (
                <div onClick={() => guardedNavigate("assinatura")} style={{ display: "flex", flexDirection: "column", gap: 12, cursor: "pointer" }}>
                  <p style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, color: MUTED, textTransform: "uppercase", margin: 0 }}>Minha Assinatura</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: 5, background: GREEN }} />
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{subAccess.subscription.plan === "annual" ? "Plano Assinante - Anual" : "Plano Assinante - Mensal"}</p>
                    </div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: GREEN, margin: 0 }}>{subAccess.subscription.plan === "annual" ? "R$ 99,90/ano" : "R$ 9,90/mês"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: GREEN, margin: 0 }}>Gerenciar assinatura</p>
                    <Icon name="arrowRight" size={14} color={GREEN} />
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, lineHeight: 1.4, color: MUTED, margin: 0 }}>Desbloqueie roteiros para acumular conquistas e destravar o nível VIP Groundhopper no seu Football Passport.</p>
                  <div onClick={() => guardedNavigate("assinatura")} style={{ background: BG_ALT, border: `1px solid ${BORDER}`, padding: "12px 16px", borderRadius: 8, textAlign: "center", cursor: "pointer" }}>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: TEXT, margin: 0 }}>Ver Minha Assinatura</p>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      <AuthedFooter />
    </div>
  );
}
