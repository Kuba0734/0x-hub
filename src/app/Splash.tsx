import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { spring, tween } from "@/components/motion/presets";
import { strings } from "@/lib/strings";
import { useReduceMotion } from "@/stores/settings";

type Step = "mark" | "wordmark";

/** The "0x" glyph from the app icon, drawn with strokes. */
function MarkGlyph({ draw }: { draw: boolean }) {
  const t = { duration: 0.5, ease: [0.2, 0, 0, 1] as const };
  return (
    <svg viewBox="200 260 660 504" className="h-14 w-auto" aria-hidden="true">
      <motion.ellipse
        cx="400"
        cy="512"
        rx="150"
        ry="210"
        fill="none"
        stroke="#fff"
        strokeWidth="64"
        initial={{ pathLength: draw ? 0 : 1 }}
        animate={{ pathLength: 1 }}
        transition={t}
      />
      <motion.path
        d="M600 382 L800 642 M800 382 L600 642"
        stroke="#fff"
        strokeWidth="64"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: draw ? 0 : 1 }}
        animate={{ pathLength: 1 }}
        transition={{ ...t, delay: 0.15 }}
      />
    </svg>
  );
}

/**
 * Launch splash: the 0x mark draws itself, slides left as "-hub" springs in to form the
 * wordmark, then the whole thing dissolves into the app.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const reduce = useReduceMotion();
  const [step, setStep] = useState<Step>("mark");

  useEffect(() => {
    const toWord = window.setTimeout(() => setStep("wordmark"), reduce ? 150 : 650);
    const done = window.setTimeout(onDone, reduce ? 600 : 1500);
    return () => {
      window.clearTimeout(toWord);
      window.clearTimeout(done);
    };
  }, [onDone, reduce]);

  return (
    <motion.div
      role="status"
      aria-label={strings.splash.label}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: tween.page }}
    >
      <motion.div
        className="flex items-center gap-3"
        exit={{ scale: 1.06, filter: "blur(10px)", opacity: 0, transition: tween.page }}
      >
        <motion.div layout transition={spring}>
          <MarkGlyph draw={!reduce} />
        </motion.div>
        {step === "wordmark" && (
          <motion.span
            layout
            className="flex text-[40px] font-semibold tracking-[-0.03em]"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.04 } } }}
          >
            {strings.app.wordmarkRest.split("").map((c, i) => (
              <motion.span
                key={i}
                variants={{
                  hidden: { opacity: 0, x: -14, filter: "blur(4px)" },
                  show: { opacity: 1, x: 0, filter: "blur(0px)", transition: spring },
                }}
              >
                {c}
              </motion.span>
            ))}
          </motion.span>
        )}
      </motion.div>
    </motion.div>
  );
}
