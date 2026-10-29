import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { FileText, Link2, X } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { LinkPickerDialog } from "@/components/ui/LinkPickerDialog";
import { useDocuments } from "@/features/documents/queries";
import { ipc, toIpcError, type Note } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { noteKeys } from "../queries";

export function LinkedDocuments({ note }: { note: Note }) {
  const qc = useQueryClient();
  const docs = useDocuments();
  const [picking, setPicking] = useState(false);
  const linked = (docs.data ?? []).filter((d) => note.linkedDocumentIds.includes(d.id));
  const candidates = (docs.data ?? []).filter((d) => !note.linkedDocumentIds.includes(d.id));

  const run = (p: Promise<void>) =>
    p.then(
      () => {
        void qc.invalidateQueries({ queryKey: noteKeys.one(note.id) });
        void qc.invalidateQueries({ queryKey: ["documents"] });
      },
      (e) => toast.error(toIpcError(e).message),
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-6 py-2.5">
      <span className="mr-1 text-[12px] text-fg-3">{strings.notes.linkedDocuments}</span>
      {linked.map((d) => (
        <span
          key={d.id}
          className="flex h-7 items-center gap-1.5 rounded-full border border-line pr-1 pl-2.5 text-[12px]"
        >
          <FileText className="h-3 w-3 text-fg-3" />
          <Link to={`/documents/${d.id}`} className="max-w-48 truncate hover:underline">
            {d.title}
          </Link>
          <button
            type="button"
            aria-label={`${strings.common.remove} ${d.title}`}
            onClick={() => void run(ipc.notes.unlink(note.id, d.id))}
            className="flex h-5 w-5 items-center justify-center rounded-full text-fg-3 hover:bg-white/10 hover:text-fg"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <GlassButton variant="ghost" size="sm" icon={<Link2 />} onClick={() => setPicking(true)}>
        {strings.notes.linkDocument}
      </GlassButton>
      <LinkPickerDialog
        open={picking}
        onClose={() => setPicking(false)}
        title={strings.notes.linkDocument}
        items={candidates.map((d) => ({ id: d.id, title: d.title, subtitle: d.filename }))}
        onPick={(id) => void run(ipc.notes.link(note.id, id))}
      />
    </div>
  );
}
