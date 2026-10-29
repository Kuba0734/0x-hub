import { useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "@/lib/pdf";
import { cn } from "@/lib/format";

interface Props {
  pdf: PDFDocumentProxy;
  /** 1-based page number in the source PDF. */
  page: number;
  /** Extra clockwise rotation in degrees. */
  rotation?: number;
  width: number;
  className?: string;
  /** Reports the rendered CSS size. */
  onRendered?: (width: number, height: number) => void;
}

/** One PDF page on a canvas. Renders run one after another (pdf.js needs that per canvas). */
export function PageCanvas({ pdf, page, rotation = 0, width, className, onRendered }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const report = useRef(onRendered);
  useEffect(() => {
    report.current = onRendered;
  }, [onRendered]);

  useEffect(() => {
    let stale = false;
    queue.current = queue.current.then(async () => {
      const el = canvas.current;
      if (stale || !el) return;
      try {
        const { renderPage } = await import("@/lib/pdf");
        await renderPage(pdf, page, el, width, rotation);
        if (!stale) report.current?.(el.clientWidth, el.clientHeight);
      } catch {
        // Keep whatever was drawn before.
      }
    });
    return () => {
      stale = true;
    };
  }, [pdf, page, rotation, width]);

  return <canvas ref={canvas} className={cn("block bg-white", className)} />;
}
