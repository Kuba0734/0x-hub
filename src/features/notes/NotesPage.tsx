import { AnimatePresence } from "motion/react";
import { useMemo, useState } from "react";
import {
  CheckSquare,
  NotebookPen,
  RotateCcw,
  Search,
  SearchX,
  StickyNote,
  Trash2,
} from "lucide-react";
import { GlassButton, GlassInput } from "@/components/glass";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { cn, relativeTime } from "@/lib/format";
import type { NoteKind } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { NoteCard } from "./components/NoteCard";
import { notePreview, useNoteLifecycle, useNotes } from "./queries";
import { useNewNote } from "./useNewNote";

type Filter = "all" | NoteKind;
const s = strings.notes;

function NotesTrash() {
  const { data, isLoading } = useNotes(true);
  const { restore, remove } = useNoteLifecycle();
  if (isLoading) return <SkeletonGrid count={3} />;
  if (!data?.length)
    return <EmptyState icon={<Trash2 />} title={s.trashEmpty} body={strings.common.trashHint} />;
  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 text-[12px] text-fg-3">{strings.common.trashHint}</p>
      {data.map((n) => (
        <div
          key={n.id}
          className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.04]"
        >
          <span className="min-w-0 flex-1 truncate text-[14px]">
            {n.title || strings.common.untitled}
          </span>
          <span className="w-28 text-[12px] text-fg-3">
            {n.deletedAt ? relativeTime(n.deletedAt) : ""}
          </span>
          <GlassButton
            size="sm"
            variant="ghost"
            icon={<RotateCcw />}
            onClick={() => restore.mutate(n.id)}
          >
            {strings.common.restore}
          </GlassButton>
          <GlassButton
            size="sm"
            variant="ghost"
            icon={<Trash2 />}
            onClick={() => remove.mutate(n.id)}
          >
            {strings.common.deleteForever}
          </GlassButton>
        </div>
      ))}
    </div>
  );
}

export function NotesPage() {
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const { data, isLoading, error, refetch } = useNotes();
  const newNote = useNewNote();

  const visible = useMemo(() => {
    const t = text.trim().toLowerCase();
    return (data ?? []).filter(
      (n) =>
        (filter === "all" || n.kind === filter) &&
        (!t || `${n.title} ${notePreview(n)}`.toLowerCase().includes(t)),
    );
  }, [data, filter, text]);

  const newButtons = (
    <div className="flex gap-1.5">
      <GlassButton variant="primary" icon={<NotebookPen />} onClick={() => newNote("markdown")}>
        {s.newNote}
      </GlassButton>
      <GlassButton icon={<CheckSquare />} onClick={() => newNote("checklist")}>
        {s.newChecklist}
      </GlassButton>
      <GlassButton icon={<StickyNote />} onClick={() => newNote("sticky")}>
        {s.newSticky}
      </GlassButton>
    </div>
  );

  const body = (() => {
    if (tab === "trash") return <NotesTrash />;
    if (isLoading) return <SkeletonGrid />;
    if (error) return <ErrorState message={error.message} onRetry={() => void refetch()} />;
    if (!data?.length)
      return (
        <EmptyState
          icon={<NotebookPen />}
          title={s.emptyTitle}
          body={s.emptyBody}
          action={newButtons}
        />
      );
    if (!visible.length) return <EmptyState icon={<SearchX />} title={s.noMatches} />;
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        <AnimatePresence initial={false}>
          {visible.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </AnimatePresence>
      </div>
    );
  })();

  return (
    <div className="h-full overflow-y-auto px-8 pt-7 pb-10">
      <PageHeader
        title={s.title}
        tabsId="notes"
        tabs={[
          { value: "active", label: strings.common.all },
          { value: "trash", label: s.trashTitle },
        ]}
        tab={tab}
        onTab={setTab}
        actions={tab === "active" ? newButtons : undefined}
      />
      {tab === "active" && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <GlassInput
            label={s.filterPlaceholder}
            hideLabel
            placeholder={s.filterPlaceholder}
            leading={<Search />}
            value={text}
            onChange={(e) => setText(e.target.value)}
            wrapperClassName="w-64"
            className="h-9 rounded-full"
          />
          <div role="radiogroup" aria-label={strings.common.filter} className="flex gap-1.5">
            {(["all", "markdown", "checklist", "sticky"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "h-8 rounded-full px-3.5 text-[13px] transition-colors",
                  filter === f
                    ? "bg-white font-medium text-black"
                    : "border border-line text-fg-2 hover:text-fg",
                )}
              >
                {s.filters[f]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5">{body}</div>
    </div>
  );
}
