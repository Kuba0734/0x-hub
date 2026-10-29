import { useRef, type PointerEvent } from "react";

/** Left-button drag scrolls the element (like a hand tool). Spread the result onto it. */
export function useDragPan() {
  const start = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const el = e.currentTarget;
      start.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      el.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = start.current;
      if (!s) return;
      e.currentTarget.scrollLeft = s.left - (e.clientX - s.x);
      e.currentTarget.scrollTop = s.top - (e.clientY - s.y);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      start.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
