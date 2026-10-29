import { useNavigate } from "react-router";
import type { NoteKind } from "@/lib/ipc";
import { useCreateNote } from "./queries";

/** Creates a note of `kind` and opens it in the editor. */
export function useNewNote() {
  const navigate = useNavigate();
  const create = useCreateNote();
  return (kind: NoteKind) =>
    create.mutate({ kind }, { onSuccess: (note) => navigate(`/notes/${note.id}`) });
}
