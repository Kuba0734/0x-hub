import { motion } from "motion/react";
import type { ReactNode } from "react";
import { pageVariants } from "./presets";

interface Props {
  /** +1 when navigating "down" the sidebar, -1 when going "up". */
  direction: number;
  children: ReactNode;
  className?: string;
}

/** Slide + fade + slight blur, direction-aware. Use inside <AnimatePresence custom={direction}>. */
export function PageTransition({ direction, children, className }: Props) {
  return (
    <motion.div
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
