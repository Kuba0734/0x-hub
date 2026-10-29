import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { PopupFrame } from "@/components/ui/PopupFrame";
import { SavedIndicator } from "@/components/ui/SavedIndicator";
import { ipc, onEvent, toIpcError, type Note, type NotePatch } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { noteShades } from "@/lib/tokens";
import { useAutosave } from "../useAutosave";

/** Pop-out sticky note: a small always-on-top frameless glass window. */
export function StickyWindow({ noteId }: { noteId: string }) {
  const [note, setNote] = useState<Note | null>(null);
  const [text, setText] = useState("");
  /** "vault": 0x-hub is locked; "note": this note is locked and not re-confirmed. */
  const [locked, setLocked] = useState<false | "vault" | "note">(false);

  const load = useCallback(() => {
    ipc.notes.get(noteId).then(
      (n) => {
        setNote(n);
        setText(n.content);
        setLocked(n.locked && !n.revealed ? "note" : false);
      },
      (e) => setLocked(toIpcError(e).code === "locked" ? "vault" : false),
    );
  }, [noteId]);

  useEffect(load, [load]);
  useEffect(() => onEvent("vault://locked", () => setLocked("vault")), []);
  useEffect(() => onEvent("vault://unlocked", load), [load]);

  // Never write while hidden: the body we hold would be empty.
  const save = useCallback(
    (patch: NotePatch) =>
      ipc.notes.update(noteId, patch).catch((e) => {
        if (toIpcError(e).code === "document_locked") setLocked("note");
        throw e;
      }),
    [noteId],
  );
  const auto = useAutosave(save);

  if (locked)
    return (
      <PopupFrame title={strings.notes.types.sticky ?? ""}>
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <Lock className="h-5 w-5 text-fg-2" />
          <p className="text-[12px] text-fg-2">
            {locked === "note" ? strings.notes.stickyLocked : strings.quickNote.locked}
          </p>
          <GlassButton size="sm" onClick={() => void ipc.app.showMain()}>
            {strings.quickNote.openApp}
          </GlassButton>
        </div>
      </PopupFrame>
    );

  return (
    <PopupFrame
      title={note?.title || strings.notes.types.sticky || ""}
      fill={note ? noteShades[note.shade] : undefined}
    >
      <div className="flex h-full flex-col">
        <textarea
          aria-label={strings.notes.stickyPlaceholder}
          placeholder={strings.notes.stickyPlaceholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            auto.queue({ content: e.target.value, plain: e.target.value });
          }}
          className="min-h-0 flex-1 resize-none bg-transparent px-3.5 pb-2 text-[14px] leading-relaxed text-fg placeholder:text-fg-3 focus-visible:outline-none"
          autoFocus
        />
        <div className="flex justify-end px-3 pb-2">
          <SavedIndicator state={auto.state} />
        </div>
      </div>
    </PopupFrame>
  );
}
