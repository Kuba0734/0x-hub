import { motion } from "motion/react";
import { springSnappy } from "@/components/motion/presets";
import { GlassTooltip } from "@/components/glass";
import { strings } from "@/lib/strings";
import { noteShades } from "@/lib/tokens";

/** Five greyscale tones instead of colors. */
export function ShadePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (shade: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label={strings.notes.shade} className="flex items-center gap-1">
      {noteShades.map((fill, i) => (
        <GlassTooltip key={fill} label={strings.notes.shadeName(i)}>
          <button
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={strings.notes.shadeName(i)}
            onClick={() => onChange(i)}
            className="relative flex h-7 w-7 items-center justify-center rounded-full"
          >
            <span
              className="h-4 w-4 rounded-full border border-white/25"
              style={{ background: fill }}
            />
            {value === i && (
              <motion.span
                layoutId="shade-ring"
                transition={springSnappy}
                className="absolute inset-0.5 rounded-full border-2 border-white"
              />
            )}
          </button>
        </GlassTooltip>
      ))}
    </div>
  );
}
