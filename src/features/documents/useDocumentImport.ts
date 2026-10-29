import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { ipc, onEvent, toIpcError, type ImportProgress } from "@/lib/ipc";
import { dialogs, onFileDrop } from "@/lib/platform";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { docKeys } from "./queries";

export interface DropState {
  x: number;
  y: number;
  count: number;
}

export interface FlyingFiles {
  key: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  count: number;
}

/**
 * Drag & drop + file picker import with progress, drop position and fresh ids for animations.
 * `getTarget` returns where dropped files should fly to (read at drop time).
 */
export function useDocumentImport(
  categoryId: string | null,
  getTarget: () => { x: number; y: number },
) {
  const qc = useQueryClient();
  const [drag, setDrag] = useState<DropState | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [flying, setFlying] = useState<FlyingFiles | null>(null);

  const run = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setProgress({ done: 0, total: paths.length, name: "" });
      try {
        const result = await ipc.documents.import(paths, categoryId);
        setFresh(new Set(result.imported));
        if (result.imported.length) toast.show(strings.documents.imported(result.imported.length));
        result.failed.forEach((f) =>
          toast.error(`${strings.documents.importFailed(f.name)}: ${f.message}`),
        );
        await qc.invalidateQueries({ queryKey: docKeys.all });
        void qc.invalidateQueries({ queryKey: ["overview"] });
      } catch (e) {
        toast.error(toIpcError(e).message);
      } finally {
        setProgress(null);
      }
    },
    [categoryId, qc],
  );

  useEffect(
    () => onEvent("progress://import", (p) => setProgress(p.done < p.total ? p : null)),
    [],
  );

  useEffect(
    () =>
      onFileDrop((p) => {
        if (p.type === "enter") setDrag({ x: p.x, y: p.y, count: p.paths.length });
        else if (p.type === "over")
          setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : { x: p.x, y: p.y, count: 1 }));
        else if (p.type === "leave") setDrag(null);
        else {
          setDrag(null);
          const t = getTarget();
          setFlying({
            key: Date.now(),
            x: p.x,
            y: p.y,
            tx: t.x,
            ty: t.y,
            count: Math.min(p.paths.length, 6),
          });
          void run(p.paths);
        }
      }),
    [run, getTarget],
  );

  const pick = useCallback(async () => {
    const paths = await dialogs.pickFiles();
    await run(paths);
  }, [run]);

  return { drag, progress, fresh, flying, clearFlying: () => setFlying(null), pick };
}
