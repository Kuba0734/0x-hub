import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, EyeOff, Undo2 } from "lucide-react";
import { GlassButton, GlassDialog } from "@/components/glass";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ipc, onEvent, toIpcError, type DocumentItem, type NormRect } from "@/lib/ipc";
import { dialogs } from "@/lib/platform";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { usePdfDocument } from "../pdf/usePdfDocument";
import { useDocumentContent } from "../queries";
import { BoxLayer } from "./BoxLayer";
import { redactedTarget } from "./redactedTarget";
import { ImageCanvas, PdfPageCanvas } from "./RedactCanvas";

const s = strings.redact;

interface Box {
  key: string;
  page: number;
  rect: NormRect;
}

export function RedactDialog({
  doc,
  open,
  onClose,
}: {
  doc: DocumentItem;
  open: boolean;
  onClose: () => void;
}) {
  const isPdf = doc.kind === "pdf";
  const content = useDocumentContent(doc.id, open && isPdf);
  const { pdf, failed } = usePdfDocument(open && isPdf ? content.data : undefined);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [page, setPage] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const pages = pdf?.numPages ?? 1;

  useEffect(
    () =>
      onEvent("progress://redact", (p) => {
        if (p.documentId === doc.id) setProgress({ done: p.done, total: p.total });
      }),
    [doc.id],
  );

  const finish = () => {
    setBoxes([]);
    setPage(0);
    setProgress(null);
    onClose();
  };

  const exportCopy = async () => {
    const { name, ext } = redactedTarget(doc);
    const target = await dialogs.saveFile(name, [{ name: ext.toUpperCase(), extensions: [ext] }]);
    if (!target) return;
    setProgress({ done: 0, total: isPdf ? pages : 0 });
    try {
      await ipc.documents.exportRedacted(
        doc.id,
        target,
        boxes.map((b) => ({ page: b.page, rect: b.rect })),
      );
      toast.show(s.exported);
      finish();
    } catch (e) {
      toast.error(toIpcError(e).message);
      setProgress(null);
    }
  };

  const onPage = boxes.filter((b) => b.page === page);
  const layer = (
    <BoxLayer
      boxes={onPage}
      onAdd={(rect) => setBoxes((bs) => [...bs, { key: crypto.randomUUID(), page, rect }])}
      onRemove={(key) => setBoxes((bs) => bs.filter((b) => b.key !== key))}
    />
  );

  const viewer = (() => {
    if (!isPdf) return <ImageCanvas doc={doc}>{layer}</ImageCanvas>;
    if (content.error || failed)
      return <ErrorState message={content.error?.message} onRetry={() => void content.refetch()} />;
    if (!pdf) return <Skeleton className="h-full rounded-2xl" />;
    return (
      <PdfPageCanvas pdf={pdf} page={page + 1}>
        {layer}
      </PdfPageCanvas>
    );
  })();

  const busy = progress !== null;
  return (
    <GlassDialog
      open={open}
      onClose={finish}
      dismissible={!busy}
      title={s.title}
      description={s.hint}
      width={960}
      footer={
        <>
          <p className="mr-auto self-center text-[12px] text-fg-3" aria-live="polite">
            {busy && progress.total
              ? s.exporting(progress.done, progress.total)
              : boxes.length
                ? s.boxes(boxes.length)
                : s.noBoxes}
          </p>
          <GlassButton
            variant="ghost"
            icon={<Undo2 />}
            onClick={() => setBoxes((bs) => bs.slice(0, -1))}
            disabled={!boxes.length || busy}
          >
            {s.undo}
          </GlassButton>
          <GlassButton
            variant="primary"
            icon={<EyeOff />}
            onClick={() => void exportCopy()}
            disabled={!boxes.length || busy}
          >
            {busy ? strings.common.loading : s.export}
          </GlassButton>
        </>
      }
    >
      {open && (
        <div className="flex flex-col gap-3">
          <div className="h-[calc(85vh-330px)] min-h-[220px] rounded-2xl bg-black/30 p-3">
            {viewer}
          </div>
          {isPdf && pages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <GlassButton
                variant="ghost"
                size="sm"
                iconOnly
                icon={<ChevronLeft />}
                aria-label={strings.documents.previousPage}
                disabled={page <= 0}
                onClick={() => setPage((p) => p - 1)}
              />
              <span className="tabular w-24 text-center text-[12px] text-fg-2">
                {strings.documents.page(page + 1, pages)}
              </span>
              <GlassButton
                variant="ghost"
                size="sm"
                iconOnly
                icon={<ChevronRight />}
                aria-label={strings.documents.nextPage}
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
              />
            </div>
          )}
          <p className="text-[12px] leading-relaxed text-fg-3">{s.flattenNote}</p>
        </div>
      )}
    </GlassDialog>
  );
}
