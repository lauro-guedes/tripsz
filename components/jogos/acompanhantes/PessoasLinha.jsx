"use client";
import { namesLabel } from "../../../lib/companions";
import { BORDER, MUTED } from "../../../lib/tokens";
import { Icon } from "../../ui/Icon";
import { PeopleAvatars } from "./ui";

/** A linha "Com Ana e Bruno" do cartão em Meus Jogos. Abre o modal "Detalhes do jogo" (e não o da experiência). */
export function PessoasLinha({ info, onOpen }) {
  const people = (info && info.people) || [];
  const invites = (info && info.invites) || [];
  if (people.length + invites.length === 0) return null;
  const names = people.map((p) => p.firstName);
  const label = names.length ? `Com ${namesLabel(names)}` : `${invites.length} ${invites.length === 1 ? "convite aguardando" : "convites aguardando"}`;
  return (
    <div
      role="button"
      aria-label="Ver quem foi com você"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
    >
      <PeopleAvatars names={names.length ? names : invites.map((i) => i.inviteeName)} label={label} />
      <Icon name="chevronRight" size={14} color={MUTED} />
    </div>
  );
}
