import type { Transition, Variants } from "motion/react";

/** The default spring. Feature code uses these presets instead of ad-hoc timings. */
export const spring: Transition = { type: "spring", stiffness: 380, damping: 32 };
/** Settles without overshoot: entrances, pages, dialogs, menus. */
export const springSmooth: Transition = { type: "spring", stiffness: 320, damping: 38, mass: 0.9 };
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 30 };
/** Small controls (toggles, presses, hover lift): quick, barely any rebound. */
export const springSnappy: Transition = { type: "spring", stiffness: 520, damping: 40 };

export const durations = { micro: 0.12, standard: 0.22, page: 0.42 } as const;

export const tween = {
  micro: { duration: durations.micro, ease: [0.2, 0, 0, 1] },
  standard: { duration: durations.standard, ease: [0.2, 0, 0, 1] },
  page: { duration: durations.page, ease: [0.2, 0, 0, 1] },
} satisfies Record<string, Transition>;

export const STAGGER = 0.035;

// Opacity and blur always ease (a spring on opacity reads as flicker); movement springs.

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { y: springSmooth, opacity: tween.standard } },
};

/** Pages overlap while switching: the old one fades out quickly as the new one slides in. */
export const pageVariants: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 18, filter: "blur(4px)" }),
  enter: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { x: springSmooth, opacity: tween.standard, filter: tween.standard },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -10,
    filter: "blur(4px)",
    transition: tween.micro,
  }),
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { scale: springSmooth, opacity: tween.standard } },
  exit: { opacity: 0, scale: 0.98, transition: tween.micro },
};

export const hoverLift = { y: -2, scale: 1.01 };
export const pressScale = { scale: 0.97 };
