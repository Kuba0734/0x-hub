import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ipc } from "./ipc";

/** How many mounted views show each locked item. */
const openViews = new Map<string, number>();

/**
 * Drops everything decrypted for a re-locked item from the cache, so the next opening
 * fetches it fresh (and gets the lock gate) instead of showing cached content.
 */
export function forgetRevealed(qc: QueryClient, id: string) {
  for (const part of ["one", "content", "ocr", "preview"])
    qc.removeQueries({ queryKey: ["documents", part, id] });
  qc.removeQueries({ queryKey: ["notes", "one", id] });
  void qc.invalidateQueries({ queryKey: ["documents", "list"] });
  void qc.invalidateQueries({ queryKey: ["notes", "list"] });
}

/**
 * Keeps a re-confirmed locked item open while a view of it is mounted. When the last view
 * closes, the item locks again, so the next opening asks for confirmation again.
 * The deferred check lets a remount (React StrictMode, re-keyed editors) keep the session.
 */
export function useRevealSession(id: string | undefined, locked: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!id || !locked) return;
    openViews.set(id, (openViews.get(id) ?? 0) + 1);
    return () => {
      const left = (openViews.get(id) ?? 1) - 1;
      if (left > 0) {
        openViews.set(id, left);
        return;
      }
      openViews.delete(id);
      setTimeout(() => {
        if (openViews.has(id)) return;
        forgetRevealed(qc, id);
        void ipc.items.conceal(id).catch(() => {});
      }, 0);
    };
  }, [id, locked, qc]);
}
