import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { HashRouter } from "react-router";
import { Splash } from "./Splash";
import { Shell } from "./Shell";
import { useAppEvents } from "./useAppEvents";
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow";
import { LockScreen } from "@/features/lock/LockScreen";
import { useSession } from "@/stores/session";
import { toast } from "@/stores/toasts";
import { strings } from "@/lib/strings";

export function App() {
  const realPhase = useSession((s) => s.phase);
  const onboarding = useSession((s) => s.onboardingActive);
  const refresh = useSession((s) => s.refresh);
  const phase = onboarding ? "onboarding" : realPhase;
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    refresh().catch(() => toast.error(strings.errors.generic));
  }, [refresh]);

  useAppEvents();

  return (
    <HashRouter>
      {phase === "onboarding" && <OnboardingFlow />}
      {(phase === "locked" || phase === "unlocked") && <Shell />}
      <AnimatePresence>{phase === "locked" && <LockScreen key="lock" />}</AnimatePresence>
      <AnimatePresence>
        {!splashDone && <Splash key="splash" onDone={() => setSplashDone(true)} />}
      </AnimatePresence>
    </HashRouter>
  );
}
