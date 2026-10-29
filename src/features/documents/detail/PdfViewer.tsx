import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { Skeleton } from "@/components/ui/Skeleton";
import type { LoadedPdf, PDFDocumentProxy } from "@/lib/pdf";
import { strings } from "@/lib/strings";

const s = strings.documents;

export function PdfViewer({ data }: { data: ArrayBuffer }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let loaded: LoadedPdf | null = null;
    let cancelled = false;
    void import("@/lib/pdf")
      .then(({ loadPdf }) => loadPdf(data))
      .then((l) => {
        loaded = l;
        if (cancelled) void l.destroy();
        else setPdf(l.doc);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [data]);

  useEffect(() => {
    if (!pdf || !canvas.current || !box.current) return;
    const width = Math.max(320, box.current.clientWidth - 48) * zoom;
    // A render superseded by a newer page/zoom may reject; the newer one wins.
    void import("@/lib/pdf")
      .then(({ renderPage }) => canvas.current && renderPage(pdf, page, canvas.current, width))
      .catch(() => {});
  }, [pdf, page, zoom]);

  if (failed) return <p className="p-8 text-[13px] text-fg-2">{s.noPreview}</p>;

  const pages = pdf?.numPages ?? 1;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-center gap-1 border-b border-line py-2">
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<ChevronLeft />}
          aria-label={s.previousPage}
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        />
        <span className="tabular w-24 text-center text-[12px] text-fg-2">
          {s.page(page, pages)}
        </span>
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<ChevronRight />}
          aria-label={s.nextPage}
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
        />
        <span className="mx-2 h-4 w-px bg-line" />
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Minus />}
          aria-label={s.zoomOut}
          disabled={zoom <= 0.5}
          onClick={() => setZoom((z) => z - 0.25)}
        />
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="tabular w-12 text-center text-[12px] text-fg-2 hover:text-fg"
          aria-label={s.resetZoom}
        >
          {Math.round(zoom * 100)}%
        </button>
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Plus />}
          aria-label={s.zoomIn}
          disabled={zoom >= 3}
          onClick={() => setZoom((z) => z + 0.25)}
        />
      </div>
      <div
        ref={box}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "PageDown")
            setPage((p) => Math.min(pages, p + 1));
          if (e.key === "ArrowLeft" || e.key === "PageUp") setPage((p) => Math.max(1, p - 1));
        }}
        className="min-h-0 flex-1 overflow-auto p-6"
      >
        {!pdf && <Skeleton className="mx-auto h-[70vh] max-w-2xl" />}
        <canvas ref={canvas} className="mx-auto rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.6)]" />
      </div>
    </div>
  );
}
