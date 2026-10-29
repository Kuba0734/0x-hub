import { useCallback, useEffect, useRef, useState } from "react";
import type { NotePatch } from "@/lib/ipc";
import type { SaveState } from "@/components/ui/SavedIndicator";

export const AUTOSAVE_DELAY_MS = 500;

/**
 * Debounced autosave: patches are merged and written 500ms after the last change.
 * Pending changes are flushed on unmount.
 */
export function useAutosave(save: (patch: NotePatch) => Promise<unknown>) {
  const pending = useRef<NotePatch | null>(null);
  const timer = useRef<number>(0);
  const saveRef = useRef(save);
  const [state, setState] = useState<SaveState>("idle");

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    if (!patch) return;
    pending.current = null;
    setState("saving");
    try {
      await saveRef.current(patch);
      setState("saved");
    } catch {
      setState("idle");
    }
  }, []);

  const queue = useCallback(
    (patch: NotePatch) => {
      pending.current = { ...pending.current, ...patch };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => () => void flush(), [flush]);

  return { queue, flush, state };
}
