"use client";
import { useEffect, useRef, useState } from "react";
import { handleProblem, normalizeHandle } from "../../../lib/companions";
import { fetchFriends, searchFriend } from "../../../lib/companionsClient";

/**
 * Busca de amigo pelo @ EXATO (mínimo 3 caracteres, com pausa de 0,4 s) + sugestões (quem você já marcou ou convidou).
 * `result.state`: idle | loading | found | none | error.
 */
export function useFriendSearch() {
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState([]);
  const [result, setResult] = useState({ state: "idle", friend: null, message: null });
  const seq = useRef(0);

  useEffect(() => {
    let alive = true;
    fetchFriends().then((r) => alive && r.ok && setFriends(r.friends || []));
    return () => {
      alive = false;
    };
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

  return { query, setQuery, friends, result };
}
