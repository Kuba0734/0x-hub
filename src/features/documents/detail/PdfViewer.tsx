import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { Skeleton } from "@/components/ui/Skeleton";
import type { LoadedPdf, PDFDocumentProxy } from "@/lib/pdf";
import { strings } from "@/lib/strings";
import { useDragPan } from "./useDragPan";

const s = strings.documents;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Point under the cursor, kept in place while zooming: fractions of the scroll area. */
interface Anchor {
  fx: number;
  fy: number;
  ox: number;
  oy: number;
}

/**
 * Page-by-page PDF preview. Wheel zooms around the cursor, left-drag pans. While zooming,
 * the canvas is scaled with a transform and re-rendered sharp once the wheel stops.
 */
export function PdfViewer({ data }: { data: ArrayBuffer }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  /** Zoom the canvas pixels were last rendered at. */
  const [rendered, setRendered] = useState(1);
  const [origin, setOrigin] = useState("50% 0");
  const [failed, setFailed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const anchor = useRef<Anchor | null>(null);
  const want = useRef({ page, zoom });
  const drawing = useRef(false);
  const pan = useDragPan();

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

  // One render at a time (pdf.js rejects concurrent renders into one canvas); the loop
  // catches up with the newest page/zoom requested meanwhile.
  const draw = useCallback(async () => {
    if (!pdf || drawing.current) return;
    drawing.current = true;
    try {
      const { renderPage } = await import("@/lib/pdf");
      for (;;) {
        const target = want.current;
        const el = canvas.current;
        const container = box.current;
        if (!el || !container) return;
        const width = Math.max(320, container.clientWidth - 48) * target.zoom;
        await renderPage(pdf, target.page, el, width);
        if (want.current === target) {
          setRendered(target.zoom);
          const a = anchor.current;
          anchor.current = null;
          if (a) {
            container.scrollLeft = a.fx * container.scrollWidth - a.ox;
            container.scrollTop = a.fy * container.scrollHeight - a.oy;
          }
          return;
        }
      }
    } catch {
      // A failed render leaves the previous page visible.
    } finally {
      drawing.current = false;
    }
  }, [pdf]);

  useEffect(() => {
    want.current = { page, zoom };
    // Page changes draw at once; zoom steps wait until the wheel settles.
    const t = setTimeout(() => void draw(), zoom === rendered ? 0 : 140);
    return () => clearTimeout(t);
    // `rendered` is deliberately not a dependency: it changes as a result of drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, zoom, draw]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const zoomTo = useCallback((next: number, clientX?: number, clientY?: number) => {
    const container = box.current;
    const el = canvas.current;
    const z = clampZoom(next);
    if (!container || !el || z === zoomRef.current) return;
    const rect = container.getBoundingClientRect();
    const ox = clientX === undefined ? container.clientWidth / 2 : clientX - rect.left;
    const oy = clientY === undefined ? container.clientHeight / 2 : clientY - rect.top;
    if (!anchor.current) {
      anchor.current = {
        fx: (container.scrollLeft + ox) / container.scrollWidth,
        fy: (container.scrollTop + oy) / container.scrollHeight,
        ox,
        oy,
      };
      // Start of a gesture: the canvas is untransformed, so its rect is exact.
      const c = el.getBoundingClientRect();
      const px = clientX === undefined ? c.width / 2 : clientX - c.left;
      const py = clientY === undefined ? 0 : clientY - c.top;
      setOrigin(`${px}px ${py}px`);
    }
    zoomRef.current = z;
    setZoom(z);
  }, []);

  // Native, non-passive listener: the wheel zooms instead of scrolling the page.
  useEffect(() => {
    const el = box.current;
    if (!el || !pdf) return;
    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      zoomTo(zoomRef.current * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pdf, zoomTo]);

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
          disabled={zoom <= MIN_ZOOM}
          onClick={() => zoomTo(zoom / 1.25)}
        />
        <button
          type="button"
          onClick={() => zoomTo(1)}
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
          disabled={zoom >= MAX_ZOOM}
          onClick={() => zoomTo(zoom * 1.25)}
        />
      </div>
      <div
        ref={box}
        tabIndex={0}
        onDoubleClick={() => zoomTo(1)}
        {...pan}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "PageDown")
            setPage((p) => Math.min(pages, p + 1));
          if (e.key === "ArrowLeft" || e.key === "PageUp") setPage((p) => Math.max(1, p - 1));
          if (e.key === "+" || e.key === "=") zoomTo(zoom * 1.25);
          if (e.key === "-") zoomTo(zoom / 1.25);
          if (e.key === "0") zoomTo(1);
        }}
        className="min-h-0 flex-1 cursor-grab overflow-auto p-6 select-none active:cursor-grabbing"
      >
        {!pdf && <Skeleton className="mx-auto h-[70vh] max-w-2xl" />}
        <canvas
          ref={canvas}
          style={{
            transform: zoom === rendered ? undefined : `scale(${zoom / rendered})`,
            transformOrigin: origin,
          }}
          className="mx-auto block rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
        />
      </div>
    </div>
  );
}
