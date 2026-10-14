"use client";
/** Vai para outro endereço (navegação completa do navegador). Fica num arquivo só pra os testes poderem interceptar. */
export function navigate(path) {
  window.location.assign(path);
}
