import { useEffect, useRef } from "react";
import { useReduceMotion, useSettings } from "@/stores/settings";
import { drawStars, STAR_LAYERS } from "./starfield";
import { useShootingStars } from "./useShootingStars";

/** How far each star layer (back → front) leans towards the cursor, in px. */
const PARALLAX_PX = [6, 14, 26];
/** Extra canvas around the window so drifting and parallax never show an edge. */
const BLEED = 60;

/**
 * Monochrome night sky behind the glass: three layers of stars that twinkle and shift in
 * depth with the cursor, soft drifting light (nebula), and now and then a shooting star.
 * Stars are drawn once per window size; all motion is transform/opacity. With the setting
 * off everything holds still; with reduce motion only the still stars remain.
 */
export function AmbientBackground() {
  const animated = useSettings((s) => s.settings?.animatedBackground ?? true);
  const reduce = useReduceMotion();
  const root = useRef<HTMLDivElement>(null);
  const sky = useRef<HTMLDivElement>(null);
  const moving = animated && !reduce;
  useShootingStars(sky, moving);

  // Draw the star canvases for the current window size.
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    let timer = 0;
    const draw = () => {
      const w = window.innerWidth + BLEED * 2;
      const h = window.innerHeight + BLEED * 2;
      host.querySelectorAll<HTMLCanvasElement>("canvas[data-layer]").forEach((c) => {
        const layer = Number(c.dataset.layer);
        const part = Number(c.dataset.part) as 0 | 1;
        const def = STAR_LAYERS[layer];
        if (def) drawStars(c, def, 7919 * (layer + 1), part, w, h);
      });
    };
    draw();
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);

  // Depth parallax: one CSS variable pair, each layer multiplies it (rAF-throttled).
  useEffect(() => {
    const el = root.current;
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
        el.style.setProperty("--px", x.toFixed(3));
        el.style.setProperty("--py", y.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    };
  }, [moving]);

  return (
    <div ref={root} className="ambient" data-moving={moving} aria-hidden="true">
      <div className="ambient-field">
        <div className="ambient-sweep" />
        <div className="ambient-blob ambient-blob--a" />
        <div className="ambient-blob ambient-blob--b" />
        <div className="ambient-blob ambient-blob--c" />
        <div className="ambient-blob ambient-blob--d" />
        <div className="ambient-blob ambient-blob--e" />
      </div>
      {STAR_LAYERS.map((_, layer) => (
        <div
          key={layer}
          className="stars"
          style={{ "--depth": `${PARALLAX_PX[layer]}px`, inset: -BLEED } as React.CSSProperties}
        >
          <canvas
            data-layer={layer}
            data-part={0}
            className={`stars-twinkle stars-twinkle--${layer}a`}
          />
          <canvas
            data-layer={layer}
            data-part={1}
            className={`stars-twinkle stars-twinkle--${layer}b`}
          />
        </div>
      ))}
      <div ref={sky} className="ambient-sky" />
      <div className="ambient-grain" />
    </div>
  );
}
