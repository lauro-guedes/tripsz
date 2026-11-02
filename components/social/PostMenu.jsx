"use client";
import { Flag, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Message, PrimaryBtn, SecondaryBtn, text } from "../convite/ConviteUi";
import { deletePost, reportPost } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, TEXT } from "../../lib/tokens";
import { ReportSheet } from "./ProfileMenu";
import { Sheet } from "./ui";

const row = (icon, label, onClick, danger = false) => (
  <div role="button" onClick={onClick} style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 4px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
    {icon}
    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: danger ? "#dc2626" : TEXT, margin: 0 }}>{label}</p>
  </div>
);

/** Menu "..." de uma publicação: a minha pode ser apagada; a dos outros, denunciada. */
export function PostMenu({ post, onClose, onDeleted }) {
  const [step, setStep] = useState("menu"); // menu | delete | report
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // trava imediata contra toque duplo
  const [error, setError] = useState(null);

  const remove = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await deletePost(post.id);
      if (r.ok) onDeleted(post.id);
      else setError({ type: "error", text: r.message });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (step === "report")
    return (
      <ReportSheet
        title="Denunciar publicação"
        intro="Por que você quer denunciar esta publicação? Quem publicou não saberá que foi você."
        send={(reason, details) => reportPost(post.id, reason, details)}
        onClose={onClose}
        doneBody="Obrigado por avisar. Vamos analisar a publicação."
      />
    );
  if (step === "delete")
    return (
      <Sheet title="Apagar publicação?" onClose={onClose}>
        <p style={text(14, TEXT)}>A publicação some do seu perfil e do feed de quem te segue, junto com as curtidas e os comentários. Não dá para desfazer.</p>
        <Message msg={error} />
        <PrimaryBtn onClick={remove} disabled={busy}>{busy ? "Apagando..." : "Apagar"}</PrimaryBtn>
        <SecondaryBtn onClick={onClose}>Cancelar</SecondaryBtn>
      </Sheet>
    );
  return (
    <Sheet title="Publicação" onClose={onClose}>
      <div>
        {post.mine ? row(<Trash2 size={20} color="#dc2626" />, "Apagar publicação", () => setStep("delete"), true) : row(<Flag size={20} color={TEXT} />, "Denunciar publicação", () => setStep("report"))}
      </div>
    </Sheet>
  );
}
