import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { strings } from "@/lib/strings";

export type SaveState = "idle" | "saving" | "saved";

export function SavedIndicator({ state }: { state: SaveState }) {
  return (
    <div className="h-5 min-w-16 text-[12px] text-fg-3" aria-live="polite">
      <AnimatePresence mode="wait">
        {state !== "idle" && (
          <motion.span
            key={state}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1"
          >
            {state === "saved" && <Check className="h-3 w-3" />}
            {state === "saving" ? strings.common.saving : strings.common.saved}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
