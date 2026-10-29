import { motion } from "motion/react";
import type { ReactNode, Ref } from "react";
import { pageVariants } from "./presets";

interface Props {
  /** +1 when navigating "down" the sidebar, -1 when going "up". */
  direction: number;
  children: ReactNode;
  className?: string;
  /** Needed by <AnimatePresence mode="popLayout"> to lift the leaving page out of the flow. */
  ref?: Ref<HTMLDivElement>;
}

/** Slide + fade + slight blur, direction-aware. Use inside <AnimatePresence custom={direction}>. */
export function PageTransition({ direction, children, className, ref }: Props) {
  return (
    <motion.div
      ref={ref}
      custom={direction}
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}
