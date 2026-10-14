/** @usuário de todos os usuários (mapa user_id -> username). Se a tabela não existir ainda, devolve um mapa vazio. */
export async function loadUsernames(supabase) {
  const map = new Map();
  try {
    const { data } = await supabase.from("profiles").select("user_id, username").limit(10000);
    (data || []).forEach((p) => p.username && map.set(p.user_id, p.username));
  } catch {
    /* sem a tabela: segue sem @ */
  }
  return map;
}
