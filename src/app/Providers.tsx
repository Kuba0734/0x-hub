import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { LiquidFilter } from "@/components/glass";
import { Toaster } from "@/components/ui/Toaster";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { useReduceMotion, useSettings } from "@/stores/settings";
import { queryClient } from "./queryClient";

/** Applies reduce-motion and glass intensity to the document. */
function AppearanceSync() {
  const reduce = useReduceMotion();
  const intensity = useSettings((s) => s.settings?.glassIntensity ?? 1);
  const load = useSettings((s) => s.load);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduce);
  }, [reduce]);

  useEffect(() => {
    document.documentElement.style.setProperty("--glass-intensity", String(intensity));
  }, [intensity]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  return (
    <QueryClientProvider client={queryClient}>
      {/* "always" keeps opacity fades but drops transform/layout movement. */}
      <MotionConfig reducedMotion={reduce ? "always" : "never"}>
        <AppearanceSync />
        <LiquidFilter />
        <AmbientBackground />
        {children}
        <Toaster />
      </MotionConfig>
    </QueryClientProvider>
  );
}
