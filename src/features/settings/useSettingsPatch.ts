import { toIpcError, type SettingsPatch } from "@/lib/ipc";
import { useSettings } from "@/stores/settings";
import { toast } from "@/stores/toasts";

/** Applies a settings patch and reports errors as toasts. Resolves to true on success. */
export function useSettingsPatch() {
  const update = useSettings((s) => s.update);
  return async (patch: SettingsPatch): Promise<boolean> => {
    try {
      await update(patch);
      return true;
    } catch (e) {
      toast.error(toIpcError(e).message);
      return false;
    }
  };
}
