import type { ReactNode } from "react";
import { X } from "lucide-react";
import { GlassPanel } from "@/components/glass";
import { win } from "@/lib/platform";
import { strings } from "@/lib/strings";

/** Frameless glass chrome for the small always-on-top windows (quick note, sticky pop-out). */
export function PopupFrame({
  title,
  children,
  fill,
  onClose,
}: {
  title: string;
  children: ReactNode;
  fill?: string;
  onClose?: () => void;
}) {
  return (
    <GlassPanel
      refract={false}
      radius={14}
      fill={fill}
      className="flex h-full flex-col overflow-hidden"
    >
      <div data-tauri-drag-region className="flex h-9 shrink-0 items-center pr-1 pl-3.5">
        <span data-tauri-drag-region className="flex-1 truncate text-[12px] font-medium text-fg-2">
          {title}
        </span>
        <button
          type="button"
          aria-label={strings.common.close}
          onClick={onClose ?? (() => void win.close())}
          className="flex h-7 w-7 items-center justify-center rounded-full text-fg-3 hover:bg-white/10 hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </GlassPanel>
  );
}
