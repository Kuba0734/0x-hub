import { create } from "zustand";
import { ipc } from "@/lib/ipc";

export type Phase = "loading" | "onboarding" | "locked" | "unlocked";

interface SessionState {
  phase: Phase;
  /** Keeps the onboarding flow on screen after the vault is created, until the user finishes it. */
  onboardingActive: boolean;
  helloEnabled: boolean;
  retryAfterMs: number;
  refresh: () => Promise<void>;
  setPhase: (phase: Phase) => void;
  setOnboardingActive: (active: boolean) => void;
}

export const useSession = create<SessionState>((set) => ({
  phase: "loading",
  onboardingActive: false,
  helloEnabled: false,
  retryAfterMs: 0,
  refresh: async () => {
    const s = await ipc.vault.status();
    set((prev) => ({
      phase: !s.initialized ? "onboarding" : s.unlocked ? "unlocked" : "locked",
      onboardingActive: prev.onboardingActive || !s.initialized,
      helloEnabled: s.helloEnabled,
      retryAfterMs: s.retryAfterMs,
    }));
  },
  setPhase: (phase) => set({ phase }),
  setOnboardingActive: (onboardingActive) => set({ onboardingActive }),
}));
