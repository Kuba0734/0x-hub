import { useEffect, useState } from "react";

/** Counts down a retry delay in whole seconds. */
export function useBackoff(initialMs: number) {
  const [until, setUntil] = useState(() => (initialMs > 0 ? Date.now() + initialMs : 0));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= now) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [until, now]);

  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  return {
    seconds,
    blocked: seconds > 0,
    start: (ms: number) => {
      const t = Date.now();
      setNow(t);
      setUntil(ms > 0 ? t + ms : 0);
    },
  };
}
