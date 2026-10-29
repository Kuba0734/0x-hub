import { useRef, type PointerEvent, type RefObject } from "react";
import type { NormRect } from "@/lib/ipc";
import { fitRect } from "./pdfEdit";

interface Drag {
  key: string;
  mode: "move" | "resize";
  /** Keep width/height ratio while resizing (signatures, check marks). */
  keepAspect: boolean;
  x: number;
  y: number;
  start: NormRect;
}

/**
 * Pointer handlers that move or resize an item, in 0..1 page coordinates of `layer`.
 * Attach `begin` to the grabbed element and spread `track` onto the same element.
 */
export function useItemDrag(
  layer: RefObject<HTMLElement | null>,
  onChange: (key: string, rect: NormRect) => void,
) {
  const drag = useRef<Drag | null>(null);

  const begin = (
    e: PointerEvent,
    key: string,
    rect: NormRect,
    mode: Drag["mode"],
    keepAspect = false,
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { key, mode, keepAspect, x: e.clientX, y: e.clientY, start: rect };
  };

  const move = (e: PointerEvent) => {
    const d = drag.current;
    const box = layer.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.x) / box.width;
    const dy = (e.clientY - d.y) / box.height;
    const r = d.start;
    if (d.mode === "move") {
      onChange(d.key, fitRect({ ...r, x: r.x + dx, y: r.y + dy }));
    } else if (d.keepAspect) {
      const w = Math.max(0.02, r.w + dx);
      onChange(d.key, fitRect({ ...r, w, h: r.h * (w / r.w) }));
    } else {
      onChange(d.key, fitRect({ ...r, w: Math.max(0.01, r.w + dx), h: Math.max(0.006, r.h + dy) }));
    }
  };

  const end = () => (drag.current = null);

  return {
    begin,
    track: { onPointerMove: move, onPointerUp: end, onPointerCancel: end },
  };
}
