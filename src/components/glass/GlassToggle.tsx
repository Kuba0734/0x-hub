import { motion } from "motion/react";
import { useId } from "react";
import { springSnappy } from "@/components/motion/presets";
import { cn } from "@/lib/format";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/** Switch with a spring thumb. Whole row is clickable; label is always present for a11y. */
export function GlassToggle({ checked, onChange, label, description, disabled, className }: Props) {
  const id = useId();
  return (
    <div className={cn("flex items-center justify-between gap-6", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[14px] text-fg">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[12px] text-fg-3">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200",
          checked
            ? "justify-end border-white/70 bg-white"
            : "justify-start border-stroke bg-white/[0.06]",
          disabled && "opacity-40",
        )}
      >
        <motion.span
          layout
          transition={springSnappy}
          className={cn(
            "block h-[18px] w-[18px] rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.5)]",
            checked ? "bg-black" : "bg-white/80",
          )}
        />
      </button>
    </div>
  );
}
