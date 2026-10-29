import { useQueryClient } from "@tanstack/react-query";
import { ipc, toIpcError, type DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { docKeys } from "../queries";

const s = strings.documents.folders;

/** Folder changes plus moving documents into folders; refreshes lists and counts. */
export function useFolderActions() {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: docKeys.folders });
    void qc.invalidateQueries({ queryKey: docKeys.all });
  };
  const run = async <T>(work: () => Promise<T>, done?: string): Promise<T | null> => {
    try {
      const out = await work();
      if (done) toast.show(done);
      return out;
    } catch (e) {
      toast.error(toIpcError(e).message);
      return null;
    } finally {
      await refresh();
    }
  };

  return {
    create: (name: string, parentId: string | null) =>
      run(() => ipc.folders.create(name, parentId), s.created),
    rename: (id: string, name: string) => run(() => ipc.folders.rename(id, name), s.renamed),
    moveFolder: (id: string, parentId: string | null) =>
      run(() => ipc.folders.move(id, parentId), s.movedFolder),
    remove: (id: string) => run(() => ipc.folders.delete(id), s.deleted),
    /** `folderId` null = top level; `label` names the target in the toast. */
    moveDocs: (docs: DocumentItem[], folderId: string | null, label: string) =>
      run(
        () =>
          Promise.all(docs.map((d) => ipc.documents.update(d.id, { folderId: folderId ?? "" }))),
        s.movedTo(label),
      ),
  };
}
