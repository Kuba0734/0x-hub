import { AnimatePresence, motion } from "motion/react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { scaleIn, springSmooth, tween } from "@/components/motion/presets";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/format";
import { GlassSurface } from "./GlassSurface";
import { GlassButton } from "./GlassButton";
import { useFocusTrap } from "./useFocusTrap";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** Hide the close button and ignore backdrop clicks (e.g. while an update installs). */
  dismissible?: boolean;
  className?: string;
  /** Morph from another element with the same layoutId (e.g. the update pill). */
  layoutId?: string;
}

/** Modal dialog: spring scale-in, dimmed backdrop, focus trap, Escape to close. */
export function GlassDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 440,
  dismissible = true,
  className,
  layoutId,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, open, dismissible ? onClose : undefined);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            className="absolute inset-0 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tween.standard}
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />
          <GlassSurface
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            refract
            solid
            radius={24}
            layoutId={layoutId}
            transition={springSmooth}
            variants={layoutId ? undefined : scaleIn}
            initial={layoutId ? { opacity: 0 } : "hidden"}
            animate={layoutId ? { opacity: 1 } : "show"}
            exit={layoutId ? { opacity: 0 } : "exit"}
            style={{ width: "100%", maxWidth: width }}
            className={cn("flex max-h-[85vh] flex-col p-6", className)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-[20px]">
                  {title}
                </h2>
                {description && (
                  <div id={descId} className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
                    {description}
                  </div>
                )}
              </div>
              {dismissible && (
                <GlassButton
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={strings.common.close}
                  icon={<X />}
                  onClick={onClose}
                />
              )}
            </div>
            {children && <div className="mt-5 min-h-0 overflow-y-auto">{children}</div>}
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </GlassSurface>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
