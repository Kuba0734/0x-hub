import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { Link2, NotebookPen, X } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { LinkPickerDialog } from "@/components/ui/LinkPickerDialog";
import { ipc, toIpcError, type DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { useNotes } from "@/features/notes/queries";
import { docKeys } from "../queries";

export function LinkedNotes({ doc }: { doc: DocumentItem }) {
  const qc = useQueryClient();
  const notes = useNotes();
  const [picking, setPicking] = useState(false);
  const linked = (notes.data ?? []).filter((n) => doc.linkedNoteIds.includes(n.id));
  const candidates = (notes.data ?? []).filter((n) => !doc.linkedNoteIds.includes(n.id));

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: docKeys.one(doc.id) });
    void qc.invalidateQueries({ queryKey: ["notes"] });
  };
  const run = (p: Promise<void>) => p.then(refresh, (e) => toast.error(toIpcError(e).message));

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium tracking-normal text-fg-2">
          {strings.documents.linkedNotes}
        </h3>
        <GlassButton variant="ghost" size="sm" icon={<Link2 />} onClick={() => setPicking(true)}>
          {strings.documents.linkNote}
        </GlassButton>
      </div>
      {linked.length === 0 && (
        <p className="text-[12px] text-fg-3">{strings.documents.noLinkedNotes}</p>
      )}
      {linked.map((n) => (
        <div
          key={n.id}
          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]"
        >
          <NotebookPen className="h-3.5 w-3.5 text-fg-3" />
          <Link
            to={`/notes/${n.id}`}
            className="min-w-0 flex-1 truncate text-[13px] hover:underline"
          >
            {n.title || strings.common.untitled}
          </Link>
          <button
            type="button"
            aria-label={`${strings.common.remove} ${n.title}`}
            onClick={() => void run(ipc.notes.unlink(n.id, doc.id))}
            className="flex h-6 w-6 items-center justify-center rounded-full text-fg-3 opacity-0 group-hover:opacity-100 hover:text-fg focus-visible:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <LinkPickerDialog
        open={picking}
        onClose={() => setPicking(false)}
        title={strings.documents.linkNote}
        items={candidates.map((n) => ({
          id: n.id,
          title: n.title,
          subtitle: strings.notes.types[n.kind],
        }))}
        onPick={(id) => void run(ipc.notes.link(id, doc.id))}
      />
    </section>
  );
}
