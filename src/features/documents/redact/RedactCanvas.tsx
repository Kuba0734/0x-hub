import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { DocumentItem } from "@/lib/ipc";
import type { PDFDocumentProxy } from "@/lib/pdf";
import { useElementSize } from "@/lib/useElementSize";
import { useObjectUrl } from "@/lib/useObjectUrl";
import { PageCanvas } from "../pdf/PageCanvas";
import { usePageAspect } from "../pdf/usePageAspect";
import { useImageSource } from "../queries";

/** Fits a page of `aspect` (width / height) into the measured area. */
function useFit(aspect: number) {
  const [ref, box] = useElementSize<HTMLDivElement>();
  const width = Math.floor(Math.max(120, Math.min(box.width, box.height * aspect)));
  return [ref, width] as const;
}

export function PdfPageCanvas({
  pdf,
  page,
  children,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  children: ReactNode;
}) {
  const aspect = usePageAspect(pdf, page, 0);
  const [fitRef, width] = useFit(aspect);
  return (
    <div ref={fitRef} className="flex h-full items-center justify-center">
      <div className="relative" style={{ width }}>
        <PageCanvas pdf={pdf} page={page} width={width} className="rounded-sm" />
        {children}
      </div>
    </div>
  );
}

const IMAGE_MAX = 3200;

/** The upright image (as Windows decodes it, so boxes line up with the export). */
export function ImageCanvas({ doc, children }: { doc: DocumentItem; children: ReactNode }) {
  const { data, mime, error, refetch } = useImageSource(doc, IMAGE_MAX);
  const url = useObjectUrl(data, mime);
  if (error) return <ErrorState message={error.message} onRetry={() => void refetch()} />;
  if (!url) return <Skeleton className="h-full rounded-2xl" />;
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative max-h-full">
        <img
          src={url}
          alt=""
          draggable={false}
          className="block max-h-[calc(85vh-354px)] max-w-full select-none"
        />
        {children}
      </div>
    </div>
  );
}
