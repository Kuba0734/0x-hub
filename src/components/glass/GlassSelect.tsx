import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { GlassMenu } from "./GlassContextMenu";
import { cn } from "@/lib/format";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}

/** Dropdown built on GlassMenu (native <select> popups can't be styled as glass). */
export function GlassSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = "md",
}: Props<T>) {
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const current = options.find((o) => o.value === value);

  const open = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ x: r.left, y: r.bottom + 6 });
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={`${label}: ${current?.label ?? ""}`}
        aria-haspopup="menu"
        aria-expanded={pos !== null}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            open();
          }
        }}
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-full border border-stroke bg-white/[0.04] text-fg hover:bg-white/[0.07]",
          size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-[14px]",
          className,
        )}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-3" />
      </button>
      <GlassMenu
        label={label}
        position={pos}
        onClose={() => {
          setPos(null);
          btn.current?.focus();
        }}
        items={options.map((o) => ({
          label: o.label,
          icon: o.value === value ? <Check /> : <span className="w-4" />,
          onSelect: () => onChange(o.value),
        }))}
      />
    </>
  );
}
