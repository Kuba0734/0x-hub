import { motion } from "motion/react";
import { GlassButton } from "@/components/glass";
import { strings } from "@/lib/strings";

export function DoneStep({ onFinish }: { onFinish: () => void }) {
  const s = strings.onboarding;
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white">
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
          <motion.path
            d="M5 12.5 L10 17.5 L19 7"
            fill="none"
            stroke="#000"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, delay: 0.15, ease: [0.2, 0, 0, 1] }}
          />
        </svg>
      </div>
      <h1 className="text-[28px]">{s.doneTitle}</h1>
      <p className="mt-3 text-[14px] text-fg-2">{s.doneBody}</p>
      <div className="mt-8 flex justify-center">
        <GlassButton variant="primary" size="lg" onClick={onFinish} data-autofocus>
          {s.finish}
        </GlassButton>
      </div>
    </div>
  );
}
