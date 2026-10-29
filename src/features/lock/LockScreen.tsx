import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Lock } from "lucide-react";
import { GlassFrost, GlassPanel } from "@/components/glass";
import { spring, tween } from "@/components/motion/presets";
import { strings } from "@/lib/strings";
import { PasswordForm } from "./PasswordForm";
import { RecoveryForm } from "./RecoveryForm";

/**
 * Frosted glass over the whole app. The frost layer has a fixed blur and only its opacity
 * animates (never the blur radius), so locking/unlocking stays cheap.
 */
export function LockScreen() {
  const [mode, setMode] = useState<"password" | "recovery">("password");

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 top-[var(--titlebar-h)] z-40 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: tween.page }}
      transition={tween.standard}
    >
      <GlassFrost />
      <GlassPanel
        refract
        solid
        layout
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-title"
        transition={spring}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
        className="relative w-full max-w-[380px] p-8"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-stroke bg-white/[0.07]">
            <Lock className="h-5 w-5" />
          </div>
          <h1 id="lock-title" className="text-[20px]">
            {mode === "password" ? strings.lock.title : strings.lock.recoverTitle}
          </h1>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === "recovery" ? 20 : -20 }}
            animate={{ opacity: 1, x: 0, transition: spring }}
            exit={{ opacity: 0, transition: tween.micro }}
          >
            {mode === "password" ? (
              <PasswordForm onForgot={() => setMode("recovery")} />
            ) : (
              <RecoveryForm onBack={() => setMode("password")} />
            )}
          </motion.div>
        </AnimatePresence>
      </GlassPanel>
    </motion.div>
  );
}
