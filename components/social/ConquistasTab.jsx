"use client";
import { useCallback, useEffect, useState } from "react";
import { loadBadgeContext } from "../../lib/badgeContext";
import { BG_ALT } from "../../lib/tokens";
import { BadgeCategoryList, computeBadgeCategories } from "../conta/MinhasConquistas";
import { EmptyState, SmallBtn } from "./ui";

/** A aba Conquistas do MEU perfil: as conquistas de viagem por categoria, do mesmo jeito do site (a conta é a mesma da tela Conquistas). */
export function ConquistasTab() {
  const [state, setState] = useState({ status: "loading" });
  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const ctx = await loadBadgeContext();
      if (!ctx) return setState({ status: "error" });
      setState({ status: "ready", categories: computeBadgeCategories(ctx) });
    } catch {
      setState({ status: "error" });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (state.status === "loading") return <EmptyState title="Carregando conquistas..." />;
  if (state.status === "error")
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "12px 16px 20px" }}>
        <EmptyState title="Não foi possível carregar as conquistas" body="Tente de novo em instantes." />
        <SmallBtn onClick={load}>Tentar de novo</SmallBtn>
      </div>
    );
  return (
    <div style={{ background: BG_ALT, padding: "20px 16px 24px" }}>
      <BadgeCategoryList categories={state.categories} isMobile />
    </div>
  );
}
