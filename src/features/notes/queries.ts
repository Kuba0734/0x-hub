import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ipc,
  toIpcError,
  type Note,
  type NoteData,
  type NoteKind,
  type NotePatch,
} from "@/lib/ipc";
import { toast } from "@/stores/toasts";

export const noteKeys = {
  all: ["notes"] as const,
  list: (trashed: boolean) => ["notes", "list", trashed ? "trash" : "active"] as const,
  one: (id: string) => ["notes", "one", id] as const,
};

export function useNotes(trashed = false) {
  return useQuery({ queryKey: noteKeys.list(trashed), queryFn: () => ipc.notes.list(trashed) });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: noteKeys.one(id),
    queryFn: () => ipc.notes.get(id),
    staleTime: Infinity,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, data }: { kind: NoteKind; data?: Partial<NoteData> }) =>
      ipc.notes.create(kind, data),
    onSuccess: (note) => {
      qc.setQueryData(noteKeys.one(note.id), note);
      void qc.invalidateQueries({ queryKey: noteKeys.list(false) });
      void qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e) => toast.error(toIpcError(e).message),
  });
}

/** Saves a patch; updates caches without refetching the note being edited. */
export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NotePatch }) => ipc.notes.update(id, patch),
    onSuccess: (note) => {
      qc.setQueryData(noteKeys.one(note.id), note);
      qc.setQueryData<Note[]>(noteKeys.list(false), (list) =>
        list?.map((n) => (n.id === note.id ? note : n)),
      );
      void qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e) => {
      const err = toIpcError(e);
      // The note's access window ran out: refetch so the editor switches to the lock gate.
      if (err.code === "document_locked") void qc.invalidateQueries({ queryKey: noteKeys.all });
      else toast.error(err.message);
    },
  });
}

export function useNoteLifecycle() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: noteKeys.all });
    void qc.invalidateQueries({ queryKey: ["overview"] });
    void qc.invalidateQueries({ queryKey: ["documents"] });
  };
  const onError = (e: unknown) => toast.error(toIpcError(e).message);
  return {
    trash: useMutation({ mutationFn: ipc.notes.trash, onSuccess: refresh, onError }),
    restore: useMutation({ mutationFn: ipc.notes.restore, onSuccess: refresh, onError }),
    remove: useMutation({ mutationFn: ipc.notes.deleteForever, onSuccess: refresh, onError }),
  };
}

/** Short text preview for cards. */
export function notePreview(n: Note): string {
  if (n.kind === "checklist")
    return n.items.map((i) => `${i.done ? "✓" : "○"} ${i.text}`).join("\n");
  return n.plain;
}
