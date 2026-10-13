// Regras do @usuário (iguais às do banco: supabase-profiles-username.sql).
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

const RESERVED = ["admin", "administrador", "tripsz", "api", "app", "suporte", "support", "ajuda", "help", "root", "www", "login", "conta", "perfil", "passaporte", "contato", "oficial", "equipe", "staff", "u", "null", "undefined", "anonimo"];

export function normalizeUsername(raw) {
  return String(raw || "").trim().replace(/^@+/, "").toLowerCase();
}

/** @returns {string|null} mensagem de erro, ou null se o formato é válido */
export function usernameError(raw) {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN) return `Use pelo menos ${USERNAME_MIN} caracteres.`;
  if (u.length > USERNAME_MAX) return `Use no máximo ${USERNAME_MAX} caracteres.`;
  if (!/^[a-z0-9._]+$/.test(u)) return "Use só letras minúsculas, números, ponto e underline.";
  if (!/^[a-z0-9]/.test(u) || !/[a-z0-9]$/.test(u)) return "Precisa começar e terminar com letra ou número.";
  if (/[._]{2}/.test(u)) return "Não use dois pontos ou underlines seguidos.";
  if (RESERVED.includes(u)) return "Esse @ não está disponível.";
  return null;
}

const strip = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Sugestão de @ a partir do nome e sobrenome: nome.sobrenome */
export function suggestUsername(first, last) {
  const f = strip(first);
  const l = strip(last);
  let b = f && l ? `${f}.${l}` : f || l;
  b = b.slice(0, USERNAME_MAX).replace(/[._]+$/, "");
  return b.length >= USERNAME_MIN ? b : "";
}
