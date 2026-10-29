/** Design tokens mirrored from src/styles/globals.css. Keep both in sync. */
export const colors = {
  bg0: "#000000",
  bg1: "#0A0A0A",
  bg2: "#141414",
  glassFill: "rgba(255,255,255,0.04)",
  glassFillHover: "rgba(255,255,255,0.07)",
  glassStroke: "rgba(255,255,255,0.10)",
  glassHighlight: "rgba(255,255,255,0.22)",
  text1: "#FFFFFF",
  text2: "#A1A1A1",
  text3: "#5C5C5C",
  line: "rgba(255,255,255,0.06)",
  focusRing: "rgba(255,255,255,0.55)",
  danger: "#D4D4D4",
  dangerBg: "rgba(255,255,255,0.08)",
} as const;

export const radius = { card: 16, panel: 24, pill: 999 } as const;

export const fontSizes = [12, 13, 14, 16, 20, 28, 40] as const;

/** Five greyscale shades for notes, darkest to brightest. Used instead of colors. */
export const noteShades = [
  // Capped at 0.18 so grey secondary text on the brightest shade still meets WCAG AA.
  "rgba(255,255,255,0.04)",
  "rgba(255,255,255,0.07)",
  "rgba(255,255,255,0.10)",
  "rgba(255,255,255,0.14)",
  "rgba(255,255,255,0.18)",
] as const;

export const glassIntensity = { min: 0.4, max: 1.4, default: 1 } as const;
