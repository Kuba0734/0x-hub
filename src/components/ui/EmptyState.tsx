import { motion } from "motion/react";
import type { ReactNode } from "react";
import { spring } from "@/components/motion/presets";

interface Props {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="flex flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div
        className="glass mb-5 flex h-16 w-16 items-center justify-center text-fg-2 [&>svg]:h-7 [&>svg]:w-7"
        style={{ ["--glass-radius" as string]: "20px" }}
      >
        <span className="glass-backdrop" aria-hidden="true" />
        {icon}
      </div>
      <h3 className="text-[16px]">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-fg-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
