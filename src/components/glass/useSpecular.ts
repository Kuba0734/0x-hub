import { useCallback, useRef, type PointerEvent } from "react";

/**
 * Cursor-following specular highlight. Writes `--mx`, `--my` and `--sheen` on the element,
 * throttled to one update per animation frame.
 */
export function useSpecular<T extends HTMLElement>() {
  const frame = useRef(0);

  const onPointerMove = useCallback((e: PointerEvent<T>) => {
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${clientX - r.left}px`);
      el.style.setProperty("--my", `${clientY - r.top}px`);
    });
  }, []);

  const onPointerEnter = useCallback((e: PointerEvent<T>) => {
    e.currentTarget.style.setProperty("--sheen", "1");
  }, []);

  const onPointerLeave = useCallback((e: PointerEvent<T>) => {
    e.currentTarget.style.setProperty("--sheen", "0");
  }, []);

  return { onPointerMove, onPointerEnter, onPointerLeave };
}
