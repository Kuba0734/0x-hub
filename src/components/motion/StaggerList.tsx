import { motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUp, STAGGER } from "./presets";

interface Props {
  children: ReactNode;
  className?: string;
  /** Delay between children in seconds (30–40ms). */
  stagger?: number;
  as?: "div" | "ul";
}

/** Staggered entrance for a list or grid. Wrap each child in <StaggerItem>. */
export function StaggerList({ children, className, stagger = STAGGER, as = "div" }: Props) {
  const Comp = as === "ul" ? motion.ul : motion.div;
  return (
    <Comp
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
  layout,
}: {
  children: ReactNode;
  className?: string;
  layout?: boolean;
}) {
  return (
    <motion.div variants={fadeUp} className={className} layout={layout}>
      {children}
    </motion.div>
  );
}
