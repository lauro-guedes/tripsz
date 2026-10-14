"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_COMPANIONS, handleProblem, normalizeHandle } from "../../../lib/companions";
import { readDraft, saveDraft } from "../../../lib/companionDraft";
import { fetchFriends, searchFriend, tagCompanions } from "../../../lib/companionsClient";
import { supabaseBrowser } from "../../../lib/supabase";

/** Nome e foto de quem está logado (pro menu de cima). */
export function useAuthedUser() {
  const [user, setUser] = useState({ name: "", avatar: null });
  useEffect(() => {
    let alive = true;
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        const meta = (data.user && data.user.user_metadata) || {};
        if (alive) setUser({ name: meta.name || (data.user && data.user.email) || "", avatar: meta.avatar_url || null });
      });
    return () => {
      alive = false;
    };
  }, []);
  return user;
}

/**
 * Estado da tela "Quem foi com você?": quem está marcado, a busca por @ (exato, a partir de 3 caracteres, com pausa
 * de 0,4 s), as sugestões de amigos e o salvar/pular. O jogo vem do rascunho guardado ao registrar (companionDraft).
 */
export function useAcompanhantes({ onNavigate }) {
  const [draft] = useState(() => readDraft());
  const [selected, setSelected] = useState([]); // [{ username, firstName }]
  const [friends, setFriends] = useState([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ state: "idle", friend: null, message: null }); // idle | loading | found | none | error
  const [invited, setInvited] = useState([]); // convites criados nesta etapa
  const [inviting, setInviting] = useState(false); // modal "Convidar alguém novo" aberto
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!draft) onNavigate("jogos"); // abriu direto pela URL, sem jogo recém-salvo
  }, []);

  useEffect(() => {
    fetchFriends().then((r) => r.ok && setFriends(r.friends || []));
  }, []);

  useEffect(() => {
    const q = normalizeHandle(query);
    if (q.length < 3) {
      setResult({ state: "idle", friend: null, message: null });
      return undefined;
    }
    if (handleProblem(query)) {
      setResult({ state: "none", friend: null, message: null }); // formato que nenhum @ tem: nem pergunta ao servidor
      return undefined;
    }
    const id = ++seq.current;
    setResult({ state: "loading", friend: null, message: null });
    const timer = setTimeout(async () => {
      const r = await searchFriend(q);
      if (id !== seq.current) return; // chegou resposta de uma busca antiga
      if (!r.ok) setResult({ state: "error", friend: null, message: r.message });
      else setResult(r.found ? { state: "found", friend: r.friend, message: null } : { state: "none", friend: null, message: null });
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const isSelected = (username) => selected.some((p) => p.username === username);
  const toggle = (p) => {
    setError(null);
    if (isSelected(p.username)) return setSelected((l) => l.filter((x) => x.username !== p.username));
    if (selected.length >= MAX_COMPANIONS) return setError(`Você pode marcar até ${MAX_COMPANIONS} amigos em um jogo.`);
    setSelected((l) => [...l, { username: p.username, firstName: p.firstName }]);
  };

  const goSaved = (tagged) => {
    saveDraft({ ...draft, tagged });
    onNavigate("jogo-salvo");
  };
  /** "Salvar jogo": marca quem foi escolhido (cada um recebe um aviso pra aceitar) e vai pra confirmação. */
  const save = async () => {
    if (!draft || saving) return;
    if (selected.length === 0) return goSaved([]);
    setSaving(true);
    setError(null);
    const r = await tagCompanions(draft.game.id, selected.map((p) => p.username));
    setSaving(false);
    if (!r.ok) return setError(r.message);
    goSaved(r.people || []);
  };
  const skip = () => goSaved([]);

  return { draft, selected, friends, query, setQuery, result, invited, setInvited, inviting, setInviting, saving, error, isSelected, toggle, save, skip };
}
