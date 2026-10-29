import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { GlassPanel } from "@/components/glass";
import { spring, tween } from "@/components/motion/presets";
import { TitleBar } from "@/app/TitleBar";
import { strings } from "@/lib/strings";
import { useSession } from "@/stores/session";
import { WelcomeStep } from "./steps/WelcomeStep";
import { PasswordStep } from "./steps/PasswordStep";
import { RecoveryStep } from "./steps/RecoveryStep";
import { HelloStep } from "./steps/HelloStep";
import { DoneStep } from "./steps/DoneStep";

const STEPS = ["welcome", "password", "recovery", "hello", "done"] as const;
type Step = (typeof STEPS)[number];

/** First run: welcome → master password → recovery key → optional Windows Hello → done. */
export function OnboardingFlow() {
  const [step, setStep] = useState<Step>("welcome");
  const [recoveryKey, setRecoveryKey] = useState("");
  const finish = useSession((s) => s.setOnboardingActive);
  const refresh = useSession((s) => s.refresh);
  const index = STEPS.indexOf(step);

  const body = (() => {
    switch (step) {
      case "welcome":
        return <WelcomeStep onNext={() => setStep("password")} />;
      case "password":
        return (
          <PasswordStep
            onCreated={(key) => {
              setRecoveryKey(key);
              setStep("recovery");
            }}
          />
        );
      case "recovery":
        return <RecoveryStep recoveryKey={recoveryKey} onNext={() => setStep("hello")} />;
      case "hello":
        return <HelloStep onNext={() => setStep("done")} />;
      case "done":
        return (
          <DoneStep
            onFinish={() => {
              setRecoveryKey("");
              finish(false);
              void refresh();
            }}
          />
        );
    }
  })();

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex flex-1 items-center justify-center p-8">
        <GlassPanel
          refract
          solid
          layout
          transition={spring}
          className="w-full max-w-[480px] overflow-hidden p-8"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
        >
          <div
            className="mb-6 flex items-center gap-1.5"
            aria-label={strings.onboarding.stepLabel(index + 1, STEPS.length)}
          >
            {STEPS.map((s, i) => (
              <motion.span
                key={s}
                className="h-1 flex-1 origin-left rounded-full bg-white"
                initial={false}
                animate={{ opacity: i <= index ? 1 : 0.15, scaleY: i === index ? 1.5 : 1 }}
                transition={spring}
              />
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0, transition: spring }}
              exit={{ opacity: 0, x: -16, transition: tween.micro }}
            >
              {body}
            </motion.div>
          </AnimatePresence>
        </GlassPanel>
      </div>
    </div>
  );
}
