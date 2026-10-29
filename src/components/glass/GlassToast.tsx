import type { PanInfo } from "motion/react";
import { useEffect } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import { spring } from "@/components/motion/presets";
import { strings } from "@/lib/strings";
import type { Toast } from "@/stores/toasts";
import { GlassSurface } from "./GlassSurface";

interface Props {
  toast: Toast;
  onDismiss: (id: number) => void;
}

const SWIPE_DISTANCE = 90;

/** A single toast: springs in from the bottom-right, swipe right to dismiss. */
export function GlassToast({ toast, onDismiss }: Props) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > 500) onDismiss(toast.id);
  };

  return (
    <GlassSurface
      layout
      solid
      refract
      radius={16}
      role={toast.tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, x: 60, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 120, transition: { duration: 0.18 } }}
      transition={spring}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.05, right: 0.9 }}
      onDragEnd={onDragEnd}
      className="pointer-events-auto flex w-[340px] cursor-grab items-center gap-3 py-3 pr-2 pl-4 active:cursor-grabbing"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
        {toast.tone === "error" ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </span>
      <p
        className={`min-w-0 flex-1 text-[13px] ${toast.tone === "error" ? "font-medium text-fg" : "text-fg"}`}
      >
        {toast.message}
      </p>
      <button
        type="button"
        aria-label={strings.toast.dismiss}
        onClick={() => onDismiss(toast.id)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-3 hover:bg-white/10 hover:text-fg"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </GlassSurface>
  );
}
