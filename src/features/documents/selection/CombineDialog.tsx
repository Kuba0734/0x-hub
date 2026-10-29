import { useQueryClient } from "@tanstack/react-query";
import { Reorder } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { FileStack, GripVertical } from "lucide-react";
import { GlassButton, GlassDialog, GlassInput } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import { ipc, onEvent, toIpcError, type DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { Thumbnail } from "../components/Thumbnail";
import { docKeys } from "../queries";

const s = strings.pdfTools;

interface Props {
  docs: DocumentItem[];
  open: boolean;
  onClose: () => void;
  /** Called after the PDF was created (e.g. to clear the selection). */
  onDone: () => void;
}

/** Orders the selected images and combines them into one new PDF document. */
export function CombineDialog({ docs, open, onClose, onDone }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [order, setOrder] = useState<string[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const ids = order ?? docs.map((d) => d.id);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const name = title ?? s.combineDefaultName;

  useEffect(
    () => onEvent("progress://pdf", (p) => setProgress({ done: p.done, total: p.total })),
    [],
  );

  const finish = () => {
    setOrder(null);
    setTitle(null);
    setProgress(null);
    onClose();
  };

  const create = async () => {
    setProgress({ done: 0, total: ids.length });
    try {
      const id = await ipc.documents.combineImages(ids, name.trim());
      await qc.invalidateQueries({ queryKey: docKeys.all });
      void qc.invalidateQueries({ queryKey: ["overview"] });
      toast.show(s.combined);
      finish();
      onDone();
      navigate(`/documents/${id}`);
    } catch (e) {
      toast.error(toIpcError(e).message);
      setProgress(null);
    }
  };

  const busy = progress !== null;
  return (
    <GlassDialog
      open={open}
      onClose={finish}
      dismissible={!busy}
      title={s.combineTitle}
      description={s.combineHint}
      width={480}
      footer={
        <>
          {busy && (
            <p className="mr-auto self-center text-[12px] text-fg-3" aria-live="polite">
              {s.combining(progress.done, progress.total)}
            </p>
          )}
          <GlassButton variant="ghost" onClick={finish} disabled={busy}>
            {strings.common.cancel}
          </GlassButton>
          <GlassButton
            variant="primary"
            icon={<FileStack />}
            onClick={() => void create()}
            disabled={busy || !name.trim()}
          >
            {s.combine}
          </GlassButton>
        </>
      }
    >
      <GlassInput
        label={s.combineName}
        value={name}
        onChange={(e) => setTitle(e.target.value)}
        data-autofocus
      />
      <Reorder.Group
        axis="y"
        values={ids}
        onReorder={setOrder}
        className="mt-4 flex max-h-[44vh] flex-col gap-1.5 overflow-y-auto"
      >
        {ids.map((id, i) => {
          const doc = byId.get(id);
          if (!doc) return null;
          return (
            <Reorder.Item
              key={id}
              value={id}
              transition={spring}
              className="flex cursor-grab items-center gap-3 rounded-xl border border-line bg-white/[0.03] p-2 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-fg-3" aria-hidden />
              <span className="tabular w-5 text-[12px] text-fg-3">{i + 1}</span>
              <Thumbnail doc={doc} className="h-11 w-11 shrink-0 rounded-lg" />
              <span className="min-w-0 truncate text-[13px]">{doc.title}</span>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </GlassDialog>
  );
}
