import { motion } from "motion/react";
import { spring } from "@/components/motion/presets";

interface Props {
  /** 0..1 */
  value: number;
  label: string;
  className?: string;
}

/** Animated progress bar. Uses scaleX (transform) instead of width. */
export function ProgressBar({ value, label, className }: Props) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={`h-1.5 overflow-hidden rounded-full bg-white/10 ${className ?? ""}`}
    >
      <motion.div
        className="h-full w-full origin-left rounded-full bg-white"
        initial={false}
        animate={{ scaleX: v }}
        transition={spring}
      />
    </div>
  );
}
