"use client";
import { BG_ALT, BODY, FONT_BODY, FONT_DISPLAY, GREEN_BUTTON, TEXT } from "../../lib/tokens";

/** Aviso ao sair do perfil com alterações que ainda não foram salvas. */
export function UnsavedChangesModal({ saving, error, onSave, onDiscard, onStay }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="unsaved-title" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 20px 50px rgba(15,23,42,0.25)" }}>
        <p id="unsaved-title" style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: TEXT, margin: 0 }}>Você tem alterações não salvas</p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: BODY, margin: 0 }}>Se sair agora, as mudanças que você fez no seu perfil serão perdidas. Quer salvar antes de sair?</p>
        {error && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div onClick={saving ? undefined : onSave} style={{ background: GREEN_BUTTON, opacity: saving ? 0.6 : 1, padding: "14px 20px", borderRadius: 8, textAlign: "center", cursor: saving ? "default" : "pointer" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>{saving ? "Salvando..." : "Salvar e sair"}</p>
          </div>
          <div onClick={saving ? undefined : onStay} style={{ background: BG_ALT, padding: "14px 20px", borderRadius: 8, textAlign: "center", cursor: saving ? "default" : "pointer" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: TEXT, margin: 0 }}>Continuar editando</p>
          </div>
          <div onClick={saving ? undefined : onDiscard} style={{ padding: "10px 20px", textAlign: "center", cursor: saving ? "default" : "pointer" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#dc2626", margin: 0 }}>Sair sem salvar</p>
          </div>
        </div>
      </div>
    </div>
  );
}
