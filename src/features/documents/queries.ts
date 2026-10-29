import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc, toIpcError, type DocumentItem, type DocumentPatch } from "@/lib/ipc";
import { toast } from "@/stores/toasts";

export const docKeys = {
  all: ["documents"] as const,
  list: (trashed: boolean) => ["documents", "list", trashed ? "trash" : "active"] as const,
  one: (id: string) => ["documents", "one", id] as const,
  ocr: (id: string) => ["documents", "ocr", id] as const,
  content: (id: string) => ["documents", "content", id] as const,
  categories: ["categories"] as const,
};

export function useDocuments(trashed = false) {
  return useQuery({ queryKey: docKeys.list(trashed), queryFn: () => ipc.documents.list(trashed) });
}

export function useDocument(id: string) {
  return useQuery({ queryKey: docKeys.one(id), queryFn: () => ipc.documents.get(id) });
}

export function useCategories() {
  return useQuery({ queryKey: docKeys.categories, queryFn: ipc.categories.list });
}

export function useOcrText(id: string, enabled: boolean) {
  return useQuery({ queryKey: docKeys.ocr(id), queryFn: () => ipc.documents.ocrText(id), enabled });
}

/** Decrypted file bytes. Never cached across sessions; cleared on lock with the whole cache. */
export function useDocumentContent(id: string, enabled = true) {
  return useQuery({
    queryKey: docKeys.content(id),
    queryFn: () => ipc.documents.content(id),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 60_000,
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DocumentPatch }) =>
      ipc.documents.update(id, patch),
    onSuccess: (doc) => {
      qc.setQueryData(docKeys.one(doc.id), doc);
      qc.setQueryData<DocumentItem[]>(docKeys.list(false), (list) =>
        list?.map((d) => (d.id === doc.id ? doc : d)),
      );
      void qc.invalidateQueries({ queryKey: ["overview"] });
      void qc.invalidateQueries({ queryKey: docKeys.categories });
    },
    onError: (e) => toast.error(toIpcError(e).message),
  });
}

/** Trash / restore / delete-forever, each refreshing every document list. */
export function useDocumentLifecycle() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: docKeys.all });
    void qc.invalidateQueries({ queryKey: ["overview"] });
    void qc.invalidateQueries({ queryKey: docKeys.categories });
  };
  const onError = (e: unknown) => toast.error(toIpcError(e).message);
  return {
    trash: useMutation({ mutationFn: ipc.documents.trash, onSuccess: refresh, onError }),
    restore: useMutation({ mutationFn: ipc.documents.restore, onSuccess: refresh, onError }),
    remove: useMutation({ mutationFn: ipc.documents.deleteForever, onSuccess: refresh, onError }),
  };
}
