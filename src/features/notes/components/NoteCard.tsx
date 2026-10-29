import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { ExternalLink, Lock, LockOpen, NotebookPen, Pin, PinOff, Trash2 } from "lucide-react";
import { GlassCard, GlassContextMenu } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import { relativeTime } from "@/lib/format";
import { ipc, type Note } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { noteShades } from "@/lib/tokens";
import { toast } from "@/stores/toasts";
import { noteIcon } from "../noteIcons";
import { notePreview, useNoteLifecycle, useUpdateNote } from "../queries";

export function NoteCard({ note }: { note: Note }) {
  const navigate = useNavigate();
  const update = useUpdateNote();
  const { trash } = useNoteLifecycle();
  const Icon = noteIcon[note.kind];
  const done = note.items.filter((i) => i.done).length;

  const menu = [
    {
      label: strings.common.open,
      icon: <NotebookPen />,
      onSelect: () => navigate(`/notes/${note.id}`),
    },
    {
      label: note.pinned ? strings.common.unpin : strings.common.pin,
      icon: note.pinned ? <PinOff /> : <Pin />,
      onSelect: () => update.mutate({ id: note.id, patch: { pinned: !note.pinned } }),
    },
    // A hidden locked note can only be opened (which asks for confirmation).
    ...(note.locked && !note.revealed
      ? []
      : [
          {
            label: note.locked ? strings.notes.unlockNote : strings.notes.lockNote,
            icon: note.locked ? <LockOpen /> : <Lock />,
            onSelect: () =>
              update.mutate(
                { id: note.id, patch: { locked: !note.locked } },
                {
                  onSuccess: () =>
                    toast.show(note.locked ? strings.notes.unlockedDone : strings.notes.lockedDone),
                },
              ),
          },
        ]),
    ...(note.kind === "sticky"
      ? [
          {
            label: strings.notes.popOut,
            icon: <ExternalLink />,
            onSelect: () => void ipc.app.openSticky(note.id),
          },
        ]
      : []),
    {
      label: strings.common.moveToTrash,
      icon: <Trash2 />,
      danger: true,
      onSelect: () =>
        trash.mutate(note.id, { onSuccess: () => toast.show(strings.documents.trashed) }),
    },
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={spring}
    >
      <GlassContextMenu items={menu} label={note.title}>
        <GlassCard
          hoverable
          fill={noteShades[note.shade]}
          role="link"
          tabIndex={0}
          aria-label={note.title || strings.common.untitled}
          onClick={() => navigate(`/notes/${note.id}`)}
          onKeyDown={(e) => e.key === "Enter" && navigate(`/notes/${note.id}`)}
          className={`flex cursor-pointer flex-col gap-2 p-4 ${note.kind === "sticky" ? "aspect-square" : "min-h-36"}`}
        >
          <div className="flex items-center gap-2 text-fg-3">
            <Icon className="h-3.5 w-3.5" />
            <span className="text-[11px] tracking-wide uppercase">
              {strings.notes.types[note.kind]}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              {note.locked && (
                <Lock className="h-3.5 w-3.5 text-fg-2" aria-label={strings.notes.lockedPreview} />
              )}
              {note.pinned && (
                <Pin className="h-3.5 w-3.5 text-fg-2" aria-label={strings.common.pinned} />
              )}
            </span>
          </div>
          {note.title && (
            <h3 className="line-clamp-2 text-[15px] font-medium tracking-[-0.01em]">
              {note.title}
            </h3>
          )}
          {note.locked && !note.revealed ? (
            <p className="flex flex-1 items-center gap-2 text-[13px] text-fg-3">
              <Lock className="h-4 w-4" />
              {strings.notes.lockedPreview}
            </p>
          ) : (
            <p className="line-clamp-5 flex-1 text-[13px] leading-relaxed whitespace-pre-line text-fg-2">
              {notePreview(note)}
            </p>
          )}
          <div className="flex items-center justify-between text-[11px] text-fg-3">
            <span>{relativeTime(note.updatedAt)}</span>
            {note.kind === "checklist" && note.items.length > 0 && (
              <span className="tabular">{strings.notes.progress(done, note.items.length)}</span>
            )}
          </div>
        </GlassCard>
      </GlassContextMenu>
    </motion.div>
  );
}
