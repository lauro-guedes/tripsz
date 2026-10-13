"use client";
import { authFetch } from "../../lib/authFetch";
import { PagamentoModal } from "./PagamentoModal";

async function json(res) {
  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error("O servidor não respondeu corretamente. Tente novamente em instantes.");
  }
  if (!res.ok) throw new Error(data.error || "Não foi possível concluir o pagamento.");
  return data;
}

/** Checkout transparente do Passaporte: mensal = cartão (recorrente); anual = cartão (recorrente) ou Pix (avulso, 365 dias). */
export function PassportCheckout({ plan, onClose, onDone }) {
  const annual = plan === "annual";
  return (
    <PagamentoModal
      amount={annual ? 175 : 16.9}
      title={annual ? "Passaporte — Plano Anual" : "Passaporte — Plano Mensal"}
      subtitle={annual ? "Cartão (renova todo ano) ou Pix (acesso por 12 meses, sem renovação automática)." : "Cobrança mensal no cartão, cancele quando quiser."}
      allowPix={annual}
      doneText="Seu Passaporte de Estádios está liberado."
      onClose={onClose}
      onApproved={() => (onDone ? onDone() : window.location.reload())}
      onCard={async (formData) => {
        const res = await authFetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, cardTokenId: formData.token }),
        });
        return json(res);
      }}
      onPix={async () => json(await authFetch("/api/subscribe/pix", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }))}
      checkPix={async (id) => (await json(await authFetch(`/api/subscribe/pix?paymentId=${encodeURIComponent(id)}`))).status}
    />
  );
}
