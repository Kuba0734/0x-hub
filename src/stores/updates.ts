import { create } from "zustand";
import { inTauri } from "@/lib/ipc";
import { updater, type Update } from "@/lib/platform";
import { strings } from "@/lib/strings";
import { useSettings } from "./settings";
import { toast } from "./toasts";

const AUTO_CHECK_GAP_MS = 60_000;

export type UpdateStatus =
  "idle" | "checking" | "available" | "downloading" | "installing" | "error";

interface UpdateState {
  status: UpdateStatus;
  update: Update | null;
  progress: number;
  dialogOpen: boolean;
  /** When the last check finished (ms), to skip checks right after one another. */
  lastCheckAt: number;
  check: (manual: boolean) => Promise<void>;
  openDialog: () => void;
  closeDialog: () => void;
  skip: () => Promise<void>;
  install: () => Promise<void>;
}

export const useUpdates = create<UpdateState>((set, get) => ({
  status: "idle",
  update: null,
  progress: 0,
  dialogOpen: false,
  lastCheckAt: 0,

  check: async (manual) => {
    if (!inTauri()) return;
    const { status: busy, lastCheckAt } = get();
    if (busy === "checking" || busy === "downloading" || busy === "installing") return;
    // Automatic checks (start, reopen from tray, timer) at most once a minute.
    if (!manual && Date.now() - lastCheckAt < AUTO_CHECK_GAP_MS) return;
    // An update already found stays offered; no need to ask GitHub again.
    if (!manual && busy === "available") return;
    set({ status: "checking" });
    try {
      const update = await updater.check();
      set({ lastCheckAt: Date.now() });
      const skipped = useSettings.getState().settings?.skipVersion;
      if (update && (manual || update.version !== skipped)) {
        set({ status: "available", update, dialogOpen: manual || get().dialogOpen });
      } else {
        set({ status: "idle", update: null });
        if (manual) toast.show(strings.settings.updatesUpToDate);
      }
    } catch {
      set({ status: "idle", lastCheckAt: Date.now() });
      if (manual) toast.error(strings.errors.generic);
    }
  },

  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => {
    const s = get().status;
    if (s !== "downloading" && s !== "installing") set({ dialogOpen: false });
  },

  skip: async () => {
    const v = get().update?.version;
    if (v) await useSettings.getState().update({ skipVersion: v });
    set({ status: "idle", update: null, dialogOpen: false });
  },

  install: async () => {
    const update = get().update;
    if (!update) return;
    let total = 0;
    let done = 0;
    set({ status: "downloading", progress: 0 });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        else if (event.event === "Progress") {
          done += event.data.chunkLength;
          set({ progress: total > 0 ? done / total : 0 });
        } else if (event.event === "Finished") set({ status: "installing", progress: 1 });
      });
      await updater.relaunch();
    } catch {
      set({ status: "error" });
      toast.error(strings.updates.failed);
    }
  },
}));
