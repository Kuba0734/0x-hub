import { AnimatePresence, motion } from "motion/react";
import {
  cloneElement,
  useEffect,
  useId,
  useState,
  type ReactElement,
  type HTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { springSnappy, tween } from "@/components/motion/presets";

interface Props {
  label: string;
  side?: "top" | "bottom" | "right";
  children: ReactElement<HTMLAttributes<HTMLElement>>;
  delay?: number;
}

type Pos = { x: number; y: number };

function place(el: HTMLElement, side: Props["side"]): Pos {
  const r = el.getBoundingClientRect();
  if (side === "right") return { x: r.right + 10, y: r.top + r.height / 2 };
  return { x: r.left + r.width / 2, y: side === "top" ? r.top - 8 : r.bottom + 8 };
}

/** Small glass tooltip, shown on hover (after `delay`) and immediately on keyboard focus. */
export function GlassTooltip({ label, side = "top", children, delay = 450 }: Props) {
  const id = useId();
  const [pos, setPos] = useState<Pos | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!pos || shown) return;
    const t = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(t);
  }, [pos, shown, delay]);

  const hide = () => {
    setPos(null);
    setShown(false);
  };

  const p = children.props;
  const visible = pos !== null && shown;
  const trigger = cloneElement(children, {
    "aria-describedby": visible ? id : undefined,
    onPointerEnter: (e) => {
      p.onPointerEnter?.(e);
      setPos(place(e.currentTarget, side));
    },
    onPointerLeave: (e) => {
      p.onPointerLeave?.(e);
      hide();
    },
    onFocus: (e) => {
      p.onFocus?.(e);
      if (e.currentTarget.matches(":focus-visible")) {
        setPos(place(e.currentTarget, side));
        setShown(true);
      }
    },
    onBlur: (e) => {
      p.onBlur?.(e);
      hide();
    },
    onPointerDown: (e) => {
      p.onPointerDown?.(e);
      hide();
    },
  } as HTMLAttributes<HTMLElement>);

  const transform =
    side === "right"
      ? "translate(0, -50%)"
      : side === "top"
        ? "translate(-50%, -100%)"
        : "translate(-50%, 0)";

  return (
    <>
      {trigger}
      {createPortal(
        <AnimatePresence>
          {visible && (
            <div
              className="pointer-events-none fixed z-[70]"
              style={{ left: pos.x, top: pos.y, transform }}
            >
              <motion.div
                id={id}
                role="tooltip"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ default: springSnappy, opacity: tween.micro }}
                className="glass glass--solid whitespace-nowrap px-2.5 py-1 text-[12px] text-fg"
                style={{ ["--glass-radius" as string]: "8px" }}
              >
                <span className="glass-backdrop" aria-hidden="true" />
                {label}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
