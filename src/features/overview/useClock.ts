import { useEffect, useState } from "react";

const msToNextMinute = (d: Date) => 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 20;

/** Current time, updated on each minute boundary (seconds aren't shown). */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t = window.setTimeout(function tick() {
      const d = new Date();
      setNow(d);
      t = window.setTimeout(tick, msToNextMinute(d));
    }, msToNextMinute(new Date()));
    return () => window.clearTimeout(t);
  }, []);
  return now;
}
