/** Tipos de pacote que a pessoa pode pedir no questionário do roteiro (id guardado em trip_answers.package_type). */
export const PACKAGE_TYPES = [
  { id: "completo", label: "Pacote completo", detail: "hospedagem, ingresso e aéreo" },
  { id: "hospedagem-ingresso", label: "Hospedagem + ingresso", detail: null },
  { id: "hospedagem-aereo", label: "Hospedagem + aéreo", detail: null },
  { id: "ingresso-aereo", label: "Ingresso + aéreo", detail: null },
  { id: "ingresso", label: "Só o ingresso", detail: null },
];
export const packageLabel = (id) => PACKAGE_TYPES.find((p) => p.id === id)?.label || "";
