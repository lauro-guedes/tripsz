"use client";
import { Flag, ShieldOff } from "lucide-react";
import { useRef, useState } from "react";
import { Message, PrimaryBtn, SecondaryBtn, text } from "../convite/ConviteUi";
import { REPORT_REASONS } from "../../lib/social";
import { reportProfile } from "../../lib/socialClient";
import { BORDER, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { Sheet } from "./ui";

const row = (icon, label, onClick, danger = false) => (
  <div role="button" onClick={onClick} style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 4px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}>
    {icon}
    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: danger ? "#dc2626" : TEXT, margin: 0 }}>{label}</p>
  </div>
);

/**
 * Passo a passo de uma denúncia (motivo + texto opcional), igual pra perfil, post e comentário.
 * `send(reason, details)` devolve { ok, message }. `doneBody`: o que aparece depois de enviar; `doneExtra`: botão a mais (ex.: bloquear).
 */
export function ReportSheet({ title, intro, send, onClose, doneTitle = "Denúncia enviada", doneBody, doneExtra = null }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // trava imediata contra toque duplo
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!reason || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const r = await send(reason, details);
      if (r.ok) setDone(true);
      else setError({ type: "error", text: r.message });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (done)
    return (
      <Sheet title={doneTitle} onClose={onClose}>
        <p style={text(14, TEXT)}>{doneBody}</p>
        <PrimaryBtn onClick={onClose}>Fechar</PrimaryBtn>
        {doneExtra}
      </Sheet>
    );
  return (
    <Sheet title={title} onClose={onClose}>
      <p style={text(13, MUTED)}>{intro}</p>
      <div role="radiogroup" aria-label="Motivo da denúncia" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {REPORT_REASONS.map((r) => {
          const on = reason === r.id;
          return (
            <div key={r.id} role="radio" aria-checked={on} onClick={() => setReason(r.id)} style={{ border: `1px solid ${on ? GREEN : BORDER}`, background: on ? "rgba(0,200,83,0.08)" : "#fff", borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
              <p style={text(14, TEXT, { fontWeight: on ? 700 : 500 })}>{r.label}</p>
            </div>
          );
        })}
      </div>
      <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} placeholder="Quer contar mais? (opcional)" aria-label="Detalhes da denúncia" rows={3} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: FONT_DISPLAY, resize: "none", outline: "none" }} />
      <Message msg={error} />
      <PrimaryBtn onClick={submit} disabled={!reason || sending}>{sending ? "Enviando..." : "Enviar denúncia"}</PrimaryBtn>
      <SecondaryBtn onClick={onClose}>Cancelar</SecondaryBtn>
    </Sheet>
  );
}

/** Menu "⋮" do perfil de outra pessoa: denunciar e bloquear. */
export function ProfileMenu({ username, displayName, onClose, onBlock }) {
  const [step, setStep] = useState("menu"); // menu | report | block

  if (step === "menu")
    return (
      <Sheet title={`@${username}`} onClose={onClose}>
        <div>
          {row(<Flag size={20} color={TEXT} />, "Denunciar perfil", () => setStep("report"))}
          {row(<ShieldOff size={20} color="#dc2626" />, `Bloquear @${username}`, () => setStep("block"), true)}
        </div>
      </Sheet>
    );

  if (step === "report")
    return (
      <ReportSheet
        title="Denunciar perfil"
        intro={`Por que você quer denunciar @${username}? Quem for denunciado não saberá que foi você.`}
        send={(reason, details) => reportProfile(username, reason, details)}
        onClose={onClose}
        doneBody={`Obrigado por avisar. Vamos analisar o perfil de @${username}. Se quiser, você também pode bloquear essa pessoa.`}
        doneExtra={<SecondaryBtn onClick={() => setStep("block")}>Bloquear @{username}</SecondaryBtn>}
      />
    );

  return (
    <Sheet title={`Bloquear @${username}?`} onClose={onClose}>
      <p style={text(14, TEXT)}>{displayName} não poderá mais ver o seu perfil nem te seguir, e vocês deixam de se seguir. Você pode desbloquear quando quiser em Editar perfil.</p>
      <PrimaryBtn onClick={onBlock}>Bloquear</PrimaryBtn>
      <SecondaryBtn onClick={onClose}>Cancelar</SecondaryBtn>
    </Sheet>
  );
}
