import { animate, useInView, useMotionValue, useTransform, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { useReduceMotion } from "@/stores/settings";

interface Props {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

/** Counts up to `value` with a spring when it first becomes visible or changes. */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReduceMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, {
      type: "spring",
      stiffness: 90,
      damping: 22,
      restDelta: 0.5,
    });
    return () => controls.stop();
  }, [inView, value, reduce, mv]);

  return (
    <motion.span ref={ref} className={`tabular ${className ?? ""}`}>
      {text}
    </motion.span>
  );
}
