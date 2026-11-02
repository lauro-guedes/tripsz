"use client";
import { Camera, MapPin, Plus } from "lucide-react";
import { text } from "../convite/ConviteUi";
import { BORDER, FONT_DISPLAY, GREEN, MUTED, TEXT } from "../../lib/tokens";
import { Sheet } from "../social/ui";

const OPTIONS = [
  { key: "checkin", label: "Fazer check-in", hint: "Você está no estádio agora", icon: MapPin },
  { key: "post-novo", label: "Nova publicação", hint: "Fotos e texto de um estádio que você já visitou", icon: Camera },
  { key: "registrar-jogo", label: "Registrar um jogo", hint: "Adicione um jogo ao seu Passaporte", icon: Plus },
];

/** O que o "+" da barra de baixo oferece: check-in, nova publicação ou registrar um jogo. */
export function AddSheet({ onPick, onClose }) {
  return (
    <Sheet title="O que você quer fazer?" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {OPTIONS.map(({ key, label, hint, icon: Icon }) => (
          <div key={key} role="button" aria-label={label} onClick={() => onPick(key)} style={{ display: "flex", gap: 14, alignItems: "center", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(0,200,83,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={22} color={GREEN} /></div>
            <div>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: TEXT, margin: 0 }}>{label}</p>
              <p style={text(12, MUTED)}>{hint}</p>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
