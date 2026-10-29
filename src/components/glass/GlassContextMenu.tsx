import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { springSnappy } from "@/components/motion/presets";
import { cn } from "@/lib/format";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  position: { x: number; y: number } | null;
  onClose: () => void;
  label?: string;
}

const MENU_W = 220;

/** The open menu. Mounted fresh on every open, so the active row resets naturally. */
function MenuBody({
  items,
  position,
  onClose,
  label,
}: MenuProps & { position: { x: number; y: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    ref.current?.focus();
    const close = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const select = (item: MenuItem | undefined) => {
    if (!item || item.disabled) return;
    onClose();
    item.onSelect();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((i) => (i + 1) % items.length);
    else if (e.key === "ArrowUp") setActive((i) => (i - 1 + items.length) % items.length);
    else if (e.key === "Enter" || e.key === " ") select(items[active]);
    else if (e.key === "Escape" || e.key === "Tab") onClose();
    else return;
    e.preventDefault();
  };

  const x = Math.min(position.x, window.innerWidth - MENU_W - 8);
  const y = Math.min(position.y, window.innerHeight - items.length * 36 - 16);

  return (
    <motion.div
      ref={ref}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      aria-activedescendant={`ctx-item-${active}`}
      onKeyDown={onKeyDown}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
      transition={springSnappy}
      style={{
        left: x,
        top: y,
        width: MENU_W,
        transformOrigin: "top left",
        ["--glass-radius" as string]: "14px",
      }}
      className="glass glass--solid fixed z-[60] p-1.5"
    >
      <span className="glass-backdrop" aria-hidden="true" />
      {items.map((item, i) => (
        <button
          key={item.label}
          id={`ctx-item-${i}`}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          tabIndex={-1}
          onPointerEnter={() => setActive(i)}
          onClick={() => select(item)}
          className={cn(
            "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] disabled:opacity-40",
            i === active ? "bg-white/[0.09] text-fg" : "text-fg-2",
            item.danger && "font-medium",
          )}
        >
          {item.icon && <span className="flex text-fg-2 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </motion.div>
  );
}

/** Floating glass menu with arrow-key navigation. */
export function GlassMenu({ position, ...rest }: MenuProps) {
  return createPortal(
    <AnimatePresence>{position && <MenuBody {...rest} position={position} />}</AnimatePresence>,
    document.body,
  );
}

interface ContextMenuProps {
  items: MenuItem[];
  children: ReactNode;
  className?: string;
  label?: string;
}

/** Right-click (or Shift+F10 / Menu key) opens a GlassMenu at the pointer. */
export function GlassContextMenu({ items, children, className, label }: ContextMenuProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const close = useCallback(() => setPos(null), []);
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.clientX === 0 && e.clientY === 0) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPos({ x: r.left + 16, y: r.top + 16 });
    } else setPos({ x: e.clientX, y: e.clientY });
  };
  return (
    <div onContextMenu={onContextMenu} className={className}>
      {children}
      <GlassMenu items={items} position={pos} onClose={close} label={label} />
    </div>
  );
}
