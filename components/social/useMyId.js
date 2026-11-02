"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase";

/** O id da pessoa logada (a pasta das fotos dela no Storage). A API social nunca devolve ids, então vem da sessão. */
export function useMyId() {
  const [id, setId] = useState(null);
  useEffect(() => {
    let alive = true;
    supabaseBrowser().auth.getUser().then(({ data }) => alive && setId(data?.user?.id || null)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return id;
}
