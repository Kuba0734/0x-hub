import { useSettings } from "@/stores/settings";

/**
 * SVG filter used by `.glass--refract` via `backdrop-filter: url(#liquid-glass)`.
 * Low-frequency turbulence displaces the backdrop slightly for the "liquid" edge.
 * Rendered once at the app root.
 */
export function LiquidFilter() {
  // Refraction follows the glass intensity (scale 8–20 across the slider's range).
  const intensity = useSettings((s) => s.settings?.glassIntensity ?? 1);
  const scale = Math.round(Math.min(20, Math.max(8, 14 * intensity)));
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }} focusable="false">
      <defs>
        <filter
          id="liquid-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.012"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
