import { AnimatePresence } from "motion/react";
import { GlassToast } from "@/components/glass";
import { strings } from "@/lib/strings";
import { useToasts } from "@/stores/toasts";

/** Bottom-right toast stack. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <section
      aria-label={strings.toast.region}
      className="pointer-events-none fixed right-5 bottom-5 z-[80] flex flex-col items-end gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <GlassToast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </section>
  );
}
