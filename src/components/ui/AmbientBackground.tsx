import { useEffect, useRef } from "react";
import { useReduceMotion, useSettings } from "@/stores/settings";

/** Furthest the light field drifts towards the cursor, in px. */
const PARALLAX_PX = 18;

/**
 * Monochrome light field behind the glass: drifting soft blobs, a slow light sweep and a
 * static grain against banding. CSS keyframes on transform/opacity only; the whole field
 * also leans a little towards the cursor (one transform, rAF-throttled).
 * Still when the setting is off; hidden with reduce motion.
 */
export function AmbientBackground() {
  const animated = useSettings((s) => s.settings?.animatedBackground ?? true);
  const reduce = useReduceMotion();
  const field = useRef<HTMLDivElement>(null);
  const moving = animated && !reduce;

  useEffect(() => {
    const el = field.current;
    if (!el || !moving) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const onMove = (e: PointerEvent) => {
      x = (e.clientX / window.innerWidth - 0.5) * 2;
      y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        el.style.transform = `translate3d(${x * PARALLAX_PX}px, ${y * PARALLAX_PX}px, 0)`;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      el.style.transform = "";
    };
  }, [moving]);

  return (
    <div className="ambient" data-moving={moving} aria-hidden="true">
      <div ref={field} className="ambient-field">
        <div className="ambient-sweep" />
        <div className="ambient-blob ambient-blob--a" />
        <div className="ambient-blob ambient-blob--b" />
        <div className="ambient-blob ambient-blob--c" />
        <div className="ambient-blob ambient-blob--d" />
        <div className="ambient-blob ambient-blob--e" />
      </div>
      <div className="ambient-grain" />
    </div>
  );
}
