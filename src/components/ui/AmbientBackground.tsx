import { useEffect, useRef } from "react";
import { useReduceMotion, useSettings } from "@/stores/settings";
import { drawStars, STAR_LAYERS } from "./starfield";
import { useShootingStars } from "./useShootingStars";

/** How far each depth (nebula, then star layers back → front) leans towards the cursor, px. */
const DEPTH_PX = [4, 6, 14, 26];
/** Extra canvas around the window so parallax never shows an edge. */
const BLEED = 40;
/** Share of the remaining distance covered per frame (frame-rate independent below). */
const EASE_PER_FRAME = 0.08;

/**
 * Monochrome night sky behind the glass: three layers of stars at different depths that
 * shift with the cursor, the front layer twinkling, a faint drifting nebula, and now and
 * then a shooting star. Stars are drawn once per window size. Parallax is one eased rAF
 * loop that writes transforms directly and stops when it settles; nothing animates
 * layout. With the setting off everything holds still; with reduce motion only still
 * stars remain.
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
        const part = c.dataset.part === undefined ? null : (Number(c.dataset.part) as 0 | 1);
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

  // Depth parallax: ease towards the cursor, only while there is distance left.
  useEffect(() => {
    const host = root.current;
    if (!host || !moving) return;
    const layers = Array.from(host.querySelectorAll<HTMLElement>("[data-depth]"));
    let frame = 0;
    let last = 0;
    const target = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    const apply = () =>
      layers.forEach((el) => {
        const d = Number(el.dataset.depth);
        el.style.transform = `translate3d(${pos.x * d}px, ${pos.y * d}px, 0)`;
      });
    const step = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      const k = 1 - Math.pow(1 - EASE_PER_FRAME, dt / 16.67);
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
      apply();
      const settled = Math.abs(target.x - pos.x) < 0.001 && Math.abs(target.y - pos.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(step);
      if (settled) last = 0;
    };
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!frame) frame = requestAnimationFrame(step);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      pos.x = pos.y = 0;
      apply();
    };
  }, [moving]);

  const front = STAR_LAYERS.length - 1;

  return (
    <div ref={root} className="ambient" data-moving={moving} aria-hidden="true">
      <div data-depth={DEPTH_PX[0]} className="ambient-field">
        <div className="ambient-blob ambient-blob--a" />
        <div className="ambient-blob ambient-blob--b" />
        <div className="ambient-blob ambient-blob--c" />
      </div>
      {STAR_LAYERS.map((_, layer) => (
        <div
          key={layer}
          data-depth={DEPTH_PX[layer + 1]}
          className="stars"
          style={{ inset: -BLEED }}
        >
          {layer === front ? (
            // Only the few bright front stars twinkle (two halves, out of phase).
            <>
              <canvas data-layer={layer} data-part={0} className="stars-twinkle" />
              <canvas data-layer={layer} data-part={1} className="stars-twinkle stars-twinkle--b" />
            </>
          ) : (
            <canvas data-layer={layer} />
          )}
        </div>
      ))}
      <div ref={sky} className="ambient-sky" />
      <div className="ambient-grain" />
    </div>
  );
}
