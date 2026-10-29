import { useQueryClient } from "@tanstack/react-query";
import { ipc, toIpcError, type DocumentItem, type DocumentPatch } from "@/lib/ipc";
import { dialogs } from "@/lib/platform";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { docKeys } from "../queries";

const s = strings.documents;

/** Actions on several documents at once. Each resolves after caches are refreshed. */
export function useBatchActions() {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: docKeys.all });
    void qc.invalidateQueries({ queryKey: docKeys.categories });
    void qc.invalidateQueries({ queryKey: ["overview"] });
  };
  const run = async (work: () => Promise<unknown>, done?: string) => {
    try {
      await work();
      if (done) toast.show(done);
    } catch (e) {
      toast.error(toIpcError(e).message);
    } finally {
      await refresh();
    }
  };
  const patchAll = (docs: DocumentItem[], patch: (d: DocumentItem) => DocumentPatch) =>
    Promise.all(docs.map((d) => ipc.documents.update(d.id, patch(d))));

  return {
    moveTo: (docs: DocumentItem[], categoryId: string) =>
      run(() => patchAll(docs, () => ({ categoryId })), s.moved),
    addTag: (docs: DocumentItem[], tag: string) =>
      run(() => patchAll(docs, (d) => ({ tags: [...d.tags, tag] })), s.tagAdded),
    setPinned: (docs: DocumentItem[], pinned: boolean) =>
      run(() => patchAll(docs, () => ({ pinned }))),
    lock: (docs: DocumentItem[]) =>
      run(() => patchAll(docs, () => ({ locked: true })), s.lockedDone),
    trash: (docs: DocumentItem[]) =>
      run(
        () => Promise.all(docs.map((d) => ipc.documents.trash(d.id))),
        s.trashedMany(docs.length),
      ),
    exportTo: async (docs: DocumentItem[]) => {
      const folder = await dialogs.pickFolder();
      if (!folder) return;
      await run(async () => {
        const r = await ipc.documents.exportMany(
          docs.map((d) => d.id),
          folder,
        );
        toast.show(s.exportedMany(r.exported));
        if (r.skipped.length) toast.show(s.skippedLocked(r.skipped.length));
      });
    },
  };
}
