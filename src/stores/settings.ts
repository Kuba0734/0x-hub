import { create } from "zustand";
import { ipc, type AppSettings, type SettingsPatch } from "@/lib/ipc";

const systemReduced = (): boolean =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface SettingsState {
  settings: AppSettings | null;
  systemReducedMotion: boolean;
  load: () => Promise<void>;
  update: (patch: SettingsPatch) => Promise<AppSettings>;
}

export const useSettings = create<SettingsState>((set) => ({
  settings: null,
  systemReducedMotion: systemReduced(),
  load: async () => {
    const settings = await ipc.settings.get();
    set({ settings });
  },
  update: async (patch) => {
    const settings = await ipc.settings.update(patch);
    set({ settings });
    return settings;
  },
}));

if (typeof window !== "undefined" && window.matchMedia) {
  window
    .matchMedia("(prefers-reduced-motion: reduce)")
    .addEventListener("change", (e) => useSettings.setState({ systemReducedMotion: e.matches }));
}

/** Effective reduce-motion: explicit setting, else the Windows setting. */
export function useReduceMotion(): boolean {
  return useSettings((s) => s.settings?.reduceMotion ?? s.systemReducedMotion);
}
