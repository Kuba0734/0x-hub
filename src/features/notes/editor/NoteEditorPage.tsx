import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ExternalLink, Lock, LockOpen, Pin, PinOff, Trash2 } from "lucide-react";
import { GlassButton, GlassPanel, GlassTooltip } from "@/components/glass";
import { ErrorState } from "@/components/ui/ErrorState";
import { RevealGate } from "@/components/ui/RevealGate";
import { SavedIndicator } from "@/components/ui/SavedIndicator";
import { Skeleton } from "@/components/ui/Skeleton";
import { ipc, type Note, type NotePatch } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { noteShades } from "@/lib/tokens";
import { toast } from "@/stores/toasts";
import { noteKeys, useNote, useNoteLifecycle, useUpdateNote } from "../queries";
import { useAutosave } from "../useAutosave";
import { ChecklistEditor } from "./ChecklistEditor";
import { LinkedDocuments } from "./LinkedDocuments";
import { MarkdownEditor } from "./MarkdownEditor";
import { ShadePicker } from "./ShadePicker";

const s = strings.notes;

function Editor({ note }: { note: Note }) {
  const navigate = useNavigate();
  const update = useUpdateNote();
  const { trash } = useNoteLifecycle();
  const [title, setTitle] = useState(note.title);
  const [items, setItems] = useState(note.items);
  const [sticky, setSticky] = useState(note.content);
  const [shade, setShade] = useState(note.shade);
  const [pinned, setPinned] = useState(note.pinned);

  const save = useCallback(
    (patch: NotePatch) => update.mutateAsync({ id: note.id, patch }),
    [update, note.id],
  );
  const auto = useAutosave(save);

  const change = (patch: NotePatch) => auto.queue(patch);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<ArrowLeft />}
          aria-label={strings.common.back}
          onClick={() => navigate("/notes")}
        />
        <input
          aria-label={s.titlePlaceholder}
          placeholder={s.titlePlaceholder}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            change({ title: e.target.value });
          }}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1 text-[20px] font-semibold tracking-[-0.02em] text-fg placeholder:text-fg-3 hover:bg-white/[0.04]"
        />
        <SavedIndicator state={auto.state} />
        <ShadePicker
          value={shade}
          onChange={(v) => {
            setShade(v);
            change({ shade: v });
          }}
        />
        <GlassTooltip label={pinned ? strings.common.unpin : strings.common.pin}>
          <GlassButton
            size="sm"
            iconOnly
            aria-label={pinned ? strings.common.unpin : strings.common.pin}
            aria-pressed={pinned}
            icon={pinned ? <PinOff /> : <Pin />}
            onClick={() => {
              setPinned(!pinned);
              change({ pinned: !pinned });
            }}
          />
        </GlassTooltip>
        <GlassTooltip label={note.locked ? s.unlockNote : s.lockNote}>
          <GlassButton
            size="sm"
            iconOnly
            aria-label={note.locked ? s.unlockNote : s.lockNote}
            aria-pressed={note.locked}
            icon={note.locked ? <LockOpen /> : <Lock />}
            onClick={async () => {
              await auto.flush();
              update.mutate(
                { id: note.id, patch: { locked: !note.locked } },
                { onSuccess: () => toast.show(note.locked ? s.unlockedDone : s.lockedDone) },
              );
            }}
          />
        </GlassTooltip>
        {note.kind === "sticky" && (
          <GlassButton
            size="sm"
            icon={<ExternalLink />}
            onClick={async () => {
              await auto.flush();
              await ipc.app.openSticky(note.id);
            }}
          >
            {s.popOut}
          </GlassButton>
        )}
        <GlassButton
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={strings.common.moveToTrash}
          icon={<Trash2 />}
          onClick={async () => {
            await auto.flush();
            trash.mutate(note.id, {
              onSuccess: () => {
                toast.show(strings.documents.trashed);
                navigate("/notes");
              },
            });
          }}
        />
      </div>
      <GlassPanel
        refract={false}
        fill={noteShades[shade]}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1">
          {note.kind === "markdown" && (
            <MarkdownEditor
              content={note.content}
              onChange={(content, plain) => change({ content, plain })}
            />
          )}
          {note.kind === "checklist" && (
            <ChecklistEditor
              items={items}
              onChange={(next) => {
                setItems(next);
                change({ items: next, plain: next.map((i) => i.text).join("\n") });
              }}
            />
          )}
          {note.kind === "sticky" && (
            <textarea
              aria-label={s.stickyPlaceholder}
              placeholder={s.stickyPlaceholder}
              value={sticky}
              onChange={(e) => {
                setSticky(e.target.value);
                change({ content: e.target.value, plain: e.target.value });
              }}
              className="h-full w-full resize-none bg-transparent px-8 py-6 text-[16px] leading-relaxed text-fg placeholder:text-fg-3 focus-visible:outline-none"
              autoFocus
            />
          )}
        </div>
        <LinkedDocuments note={note} />
      </GlassPanel>
    </div>
  );
}

function LockedNote({ note }: { note: Note }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<ArrowLeft />}
          aria-label={strings.common.back}
          onClick={() => navigate("/notes")}
        />
        <h1 className="truncate px-1 text-[20px]">{note.title || strings.common.untitled}</h1>
      </div>
      <RevealGate
        title={s.lockedTitle}
        onReveal={async (password) => {
          await ipc.notes.reveal(note.id, password);
          await qc.invalidateQueries({ queryKey: noteKeys.all });
        }}
      />
    </div>
  );
}

export function NoteEditorPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error, refetch } = useNote(id);
  if (isLoading) return <Skeleton className="m-6 h-[calc(100%-48px)] rounded-3xl" />;
  if (error || !data)
    return (
      <ErrorState
        message={error?.message ?? strings.errors.loadFailed}
        onRetry={() => void refetch()}
      />
    );
  if (data.locked && !data.revealed) return <LockedNote note={data} />;
  // Remount when access changes so the editors start from the real (or hidden) body.
  return <Editor key={`${data.id}-${data.locked}-${data.revealed}`} note={data} />;
}
