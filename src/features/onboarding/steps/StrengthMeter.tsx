import { motion } from "motion/react";
import { spring } from "@/components/motion/presets";
import { passwordScore } from "@/lib/password";
import { strings } from "@/lib/strings";

/** Greyscale strength meter: more and brighter segments as the password gets stronger. */
export function StrengthMeter({ password }: { password: string }) {
  const score = passwordScore(password);
  const label = strings.onboarding.strength[score];
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div
        className="flex flex-1 gap-1"
        role="meter"
        aria-label={strings.onboarding.strengthLabel}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={label}
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="h-1 flex-1 rounded-full bg-white"
            initial={false}
            animate={{ opacity: password && i < Math.max(score, 1) ? 0.35 + score * 0.16 : 0.1 }}
            transition={spring}
          />
        ))}
      </div>
      <span
        className={`w-20 text-right text-[12px] ${score >= 3 ? "font-medium text-fg" : "text-fg-2"}`}
      >
        {password ? label : ""}
      </span>
    </div>
  );
}
