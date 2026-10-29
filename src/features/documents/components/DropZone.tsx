import { AnimatePresence, motion } from "motion/react";
import { FileUp } from "lucide-react";
import { GlassFrost, GlassPanel } from "@/components/glass";
import { spring, springSoft, tween } from "@/components/motion/presets";
import { strings } from "@/lib/strings";
import { useReduceMotion } from "@/stores/settings";
import type { DropState, FlyingFiles } from "../useDocumentImport";

/** Expanding rings at the cursor: the "liquid" ripple. Transform + opacity only. */
function Ripple({ x, y }: { x: number; y: number }) {
  return (
    <div className="pointer-events-none fixed" style={{ left: x, top: y }} aria-hidden="true">
      {[0, 0.5, 1].map((delay) => (
        <motion.span
          key={delay}
          className="absolute -top-20 -left-20 h-40 w-40 rounded-full border border-white/40"
          initial={{ scale: 0.2, opacity: 0.8 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 1.5, delay, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
      <span className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_70%)]" />
    </div>
  );
}

export function DropOverlay({ drag }: { drag: DropState | null }) {
  const reduce = useReduceMotion();
  return (
    <AnimatePresence>
      {drag && (
        <motion.div
          className="fixed inset-x-0 bottom-0 top-[var(--titlebar-h)] z-30 flex items-center justify-center p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={tween.standard}
        >
          <GlassFrost />
          {!reduce && <Ripple x={drag.x} y={drag.y} />}
          <GlassPanel
            refract
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            transition={spring}
            className="flex h-full w-full flex-col items-center justify-center border-dashed !border-white/30 shadow-[0_0_80px_rgba(255,255,255,0.08)_inset]"
          >
            <motion.div
              animate={reduce ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-black"
            >
              <FileUp className="h-7 w-7" />
            </motion.div>
            <p className="text-[20px] font-semibold tracking-[-0.02em]">
              {strings.documents.dropTitle}
            </p>
            <p className="mt-1.5 text-[13px] text-fg-2">{strings.documents.dropBody}</p>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small glass file chips that fly from the drop point into the top of the grid. */
export function FlyingChips({
  flying,
  onDone,
}: {
  flying: FlyingFiles | null;
  onDone: () => void;
}) {
  const reduce = useReduceMotion();
  if (!flying || reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30" aria-hidden="true">
      {Array.from({ length: flying.count }, (_, i) => (
        <motion.div
          key={`${flying.key}-${i}`}
          className="glass glass--solid absolute flex h-12 w-10 items-center justify-center"
          style={{ left: 0, top: 0, ["--glass-radius" as string]: "8px" }}
          initial={{
            x: flying.x - 20,
            y: flying.y - 24,
            scale: 1,
            opacity: 1,
            rotate: (i - flying.count / 2) * 8,
          }}
          animate={{ x: flying.tx + i * 14, y: flying.ty, scale: 0.5, opacity: 0, rotate: 0 }}
          transition={{
            ...springSoft,
            delay: i * 0.04,
            opacity: { duration: 0.6, delay: 0.25 + i * 0.04 },
          }}
          onAnimationComplete={i === flying.count - 1 ? onDone : undefined}
        >
          <FileUp className="h-4 w-4 text-fg-2" />
        </motion.div>
      ))}
    </div>
  );
}
