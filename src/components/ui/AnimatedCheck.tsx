import { motion } from "motion/react";
import { springSnappy } from "@/components/motion/presets";
import { useReduceMotion } from "@/stores/settings";
import { cn } from "@/lib/format";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}

/** Checkbox whose tick draws itself (pathLength stroke animation). */
export function AnimatedCheck({ checked, onChange, label, className }: Props) {
  const reduce = useReduceMotion();
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      whileTap={reduce ? undefined : { scale: 0.85 }}
      transition={springSnappy}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-200",
        checked ? "border-white bg-white" : "border-white/30 bg-white/[0.03] hover:border-white/60",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <motion.path
          d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
          fill="none"
          stroke="#000"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  pathLength: { duration: 0.28, ease: [0.2, 0, 0, 1] },
                  opacity: { duration: 0.05 },
                }
          }
        />
      </svg>
    </motion.button>
  );
}
