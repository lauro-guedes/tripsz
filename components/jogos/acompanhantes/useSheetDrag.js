"use client";
import { useRef, useState } from "react";

// Arrastar a alça (ou o cabeçalho) pra baixo mais que isto minimiza; menos que isto, a folha volta.
const DISMISS_DISTANCE = 90;

/**
 * Gesto de "minimizar" da folha no celular: arrastar pra baixo fecha, tocar na alça também.
 * `dragProps(tapCloses)` devolve os eventos de toque de uma região; `tapCloses` = um toque simples ali fecha
 * (só a alça; no cabeçalho um toque não faz nada). Arrastar pra CIMA e soltar não conta como toque.
 */
export function useSheetDrag(onClose) {
  const [dragY, setDragY] = useState(0); // quanto a folha foi arrastada pra baixo
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ startY: 0, dy: 0, moved: 0 });

  const dragProps = (tapCloses) => ({
    onTouchStart: (e) => {
      drag.current = { startY: e.touches[0].clientY, dy: 0, moved: 0 };
      setDragging(true);
    },
    onTouchMove: (e) => {
      const raw = e.touches[0].clientY - drag.current.startY;
      const dy = Math.max(0, raw); // só acompanha o dedo pra BAIXO
      drag.current.dy = dy;
      drag.current.moved = Math.max(drag.current.moved, Math.abs(raw));
      setDragY(dy);
    },
    onTouchEnd: () => {
      setDragging(false);
      const { dy, moved } = drag.current;
      drag.current = { startY: 0, dy: 0, moved: 0 };
      if (dy > DISMISS_DISTANCE || (tapCloses && moved < 6)) onClose();
      else setDragY(0);
    },
    onTouchCancel: () => {
      setDragging(false);
      setDragY(0);
    },
  });

  return { dragY, dragging, dragProps };
}
