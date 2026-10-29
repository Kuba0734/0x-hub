/** Star layers for the ambient background, drawn once per size onto canvases. */

export interface StarLayer {
  /** Stars per million CSS px². */
  density: number;
  minR: number;
  maxR: number;
  minAlpha: number;
  maxAlpha: number;
}

/** Back to front: many faint specks, a middle layer, a few bright stars with a glow. */
export const STAR_LAYERS: StarLayer[] = [
  { density: 260, minR: 0.35, maxR: 0.8, minAlpha: 0.25, maxAlpha: 0.6 },
  { density: 90, minR: 0.6, maxR: 1.15, minAlpha: 0.45, maxAlpha: 0.85 },
  { density: 22, minR: 0.9, maxR: 1.7, minAlpha: 0.7, maxAlpha: 1 },
];

/** Small deterministic PRNG (mulberry32), so a resize keeps the same sky. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws one layer split in two halves (`part` 0 or 1), so the halves can twinkle out of
 * phase. Every star is assigned to one half by the same random sequence.
 */
export function drawStars(
  canvas: HTMLCanvasElement,
  layer: StarLayer,
  seed: number,
  part: 0 | 1,
  width: number,
  height: number,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  const rand = rng(seed);
  const count = Math.round((width * height * layer.density) / 1_000_000);
  for (let i = 0; i < count; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = layer.minR + rand() * (layer.maxR - layer.minR);
    const a = layer.minAlpha + rand() * (layer.maxAlpha - layer.minAlpha);
    const half = rand() < 0.5 ? 0 : 1;
    if (half !== part) continue;
    if (r > 1.2) {
      // Bright stars get a soft halo.
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, `rgba(255,255,255,${a * 0.35})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
