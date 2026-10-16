"use client";
import { Plus, UserSearch } from "lucide-react";
import { BORDER, MUTED, TEXT } from "../../../lib/tokens";
import { Card, SecondaryBtn, text } from "../../convite/ConviteUi";
import { CampoArroba } from "./CampoArroba";
import { Chip, FriendRow, mono } from "./ui";

/** O cartão da direita: quem está marcado, a busca por @, as sugestões e "Convidar alguém novo". */
export function BuscaAmigos({ s }) {
  const n = s.selected.length;
  const q = s.query.trim();
  const counter = n === 0 ? "Ninguém marcado ainda" : `${n} ${n === 1 ? "amigo marcado" : "amigos marcados"}`;
  const suggestions = s.friends;
  return (
    <Card>
      <p style={mono(10)}>{counter}</p>
      {(n > 0 || s.invited.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {s.selected.map((p) => (
            <Chip key={p.username} person={p} note="Marcado, aguardando aceite" onRemove={() => s.toggle(p)} />
          ))}
          {s.invited.map((inv) => (
            <Chip key={inv.id} person={{ firstName: inv.inviteeName }} note="Convite criado" />
          ))}
        </div>
      )}
      <div>
        <CampoArroba value={s.query} onChange={s.setQuery} ariaLabel="Buscar amigo no tripsz" />
        <p style={text(11, MUTED, { marginTop: 6 })}>Digite o usuário exato do seu amigo (o @ já está aí), com pelo menos 3 letras. Ex.: ana.santos</p>
      </div>
      <div>
        {q.length >= 3 ? (
          <>
            {s.result.state === "loading" && <p style={text(12)}>Buscando...</p>}
            {s.result.state === "error" && <p role="alert" style={text(12, "#b91c1c", { fontWeight: 600 })}>{s.result.message}</p>}
            {s.result.state === "found" && (
              <>
                <p style={mono(10)}>Resultado da busca</p>
                <FriendRow person={s.result.friend} marked={s.isSelected(s.result.friend.username)} onToggle={() => s.toggle(s.result.friend)} />
              </>
            )}
            {s.result.state === "none" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 0", textAlign: "center" }}>
                <UserSearch size={32} color={MUTED} />
                <p style={text(15, TEXT, { fontWeight: 700 })}>Nenhum amigo encontrado para “@{q}”</p>
                <p style={text(12)}>Essa pessoa ainda não está no tripsz? Envie um convite para guardar essa lembrança com você.</p>
              </div>
            )}
          </>
        ) : suggestions.length > 0 ? (
          <>
            <p style={mono(10)}>Sugestões de amigos</p>
            {suggestions.map((p) => (
              <FriendRow key={p.username} person={p} marked={s.isSelected(p.username)} onToggle={() => s.toggle(p)} />
            ))}
          </>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ background: BORDER, height: 1, flex: 1 }} />
        <p style={mono(10)}>Não achou?</p>
        <div style={{ background: BORDER, height: 1, flex: 1 }} />
      </div>
      <SecondaryBtn onClick={() => s.setInviting(true)} icon={<Plus size={16} color={TEXT} />}>Convidar alguém novo</SecondaryBtn>
      <p style={text(12)}>Você pode salvar sem marcar ninguém e convidar depois.</p>
    </Card>
  );
}
