"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { blockUser, followUser, getMyProfile, getProfile, unblockUser, unfollowUser } from "../../lib/socialClient";

/**
 * Carrega o perfil (o meu, se `username` for nulo) e executa as ações (seguir, deixar de seguir, bloquear...).
 * status: loading | error | onboarding (meu perfil ainda sem os 4 passos) | ready.
 */
export function useProfile(username) {
  const [state, setState] = useState({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // trava imediata: dois toques no mesmo instante não passam (o estado do React só atualiza depois)
  const [notice, setNotice] = useState(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setState({ status: "loading" });
      if (!username) {
        const me = await getMyProfile();
        if (!me.ok) return setState({ status: "error", code: me.code, message: me.message });
        if (!me.onboarded) return setState({ status: "onboarding", me });
        const full = await getProfile(me.profile.username);
        return setState(full.ok ? { status: "ready", self: true, data: full } : { status: "error", code: full.code, message: full.message });
      }
      const r = await getProfile(username);
      setState(r.ok ? { status: "ready", self: false, data: r } : { status: "error", code: r.code, message: r.message });
    },
    [username]
  );
  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const r = await fn();
      if (!r.ok) setNotice({ type: "error", text: r.message });
      else await load(true);
      return r;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const target = state.data && state.data.profile.username;

  return {
    state,
    busy,
    notice,
    reload: () => load(),
    follow: () => act(() => followUser(target)),
    unfollow: () => act(() => unfollowUser(target)),
    block: () => act(() => blockUser(target)),
    unblock: () => act(() => unblockUser(target)),
    clearNotice: () => setNotice(null),
  };
}
