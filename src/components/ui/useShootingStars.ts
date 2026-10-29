import { useEffect, type RefObject } from "react";

/** Seconds between shooting stars (random within the range). */
const MIN_GAP_S = 6;
const MAX_GAP_S = 16;

const between = (a: number, b: number) => a + Math.random() * (b - a);

/** One streak: a short bright head with a fading tail, crossing the sky diagonally. */
function launch(host: HTMLElement) {
  const { innerWidth: w, innerHeight: h } = window;
  const el = document.createElement("div");
  el.className = "shooting-star";
  const length = between(110, 220);
  const angle = between(18, 38); // degrees below the horizon, travelling left
  const distance = between(0.35, 0.6) * Math.hypot(w, h);
  const startX = between(0.35, 1.05) * w;
  const startY = between(-0.05, 0.4) * h;
  el.style.width = `${length}px`;
  el.style.left = `${startX}px`;
  el.style.top = `${startY}px`;
  host.appendChild(el);

  const rad = (angle * Math.PI) / 180;
  const dx = -Math.cos(rad) * distance;
  const dy = Math.sin(rad) * distance;
  const rotate = `rotate(${180 - angle}deg)`;
  const anim = el.animate(
    [
      { transform: `translate3d(0, 0, 0) ${rotate} scaleX(0.3)`, opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) ${rotate} scaleX(1)`, opacity: 0 },
    ],
    { duration: between(850, 1400), easing: "cubic-bezier(0.3, 0, 0.6, 1)" },
  );
  anim.onfinish = () => el.remove();
  anim.oncancel = () => el.remove();
}

/** Sends a shooting star across `host` every few seconds while `active`. */
export function useShootingStars(host: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const el = host.current;
    if (!el || !active) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          // Skip while the window is hidden (tray); keep the rhythm going.
          if (document.visibilityState === "visible") {
            launch(el);
            // Now and then a second one follows closely.
            if (Math.random() < 0.18) window.setTimeout(() => launch(el), between(250, 700));
          }
          schedule();
        },
        between(MIN_GAP_S, MAX_GAP_S) * 1000,
      );
    };
    // The first one comes soon after start, so the sky feels alive right away.
    timer = window.setTimeout(
      () => {
        launch(el);
        schedule();
      },
      between(1500, 3500),
    );
    return () => {
      window.clearTimeout(timer);
      el.querySelectorAll(".shooting-star").forEach((s) => s.remove());
    };
  }, [host, active]);
}
