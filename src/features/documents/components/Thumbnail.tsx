import { useEffect, useRef, useState } from "react";
import { File, FileImage, FileSpreadsheet, FileText, FileType } from "lucide-react";
import type { DocumentItem } from "@/lib/ipc";
import { useObjectUrl } from "@/lib/useObjectUrl";
import { useDocumentContent, useImageSource } from "../queries";

const THUMB_MAX_BYTES = 15 * 1024 * 1024;
/** Longer side of generated thumbnails for non-web images (HEIC, TIFF). */
const THUMB_IMAGE_MAX = 480;

export function KindIcon({ kind, className }: { kind: DocumentItem["kind"]; className?: string }) {
  const Icon = {
    pdf: FileType,
    image: FileImage,
    office: FileSpreadsheet,
    text: FileText,
    generic: File,
  }[kind];
  return <Icon className={className} strokeWidth={1.5} />;
}

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setSeen(true), {
      rootMargin: "200px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

/**
 * In-memory thumbnail: images via object URL, PDFs by rendering page 1.
 * Generated lazily when visible; nothing is written to disk.
 */
export function Thumbnail({ doc, className }: { doc: DocumentItem; className?: string }) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const wants = (doc.kind === "image" || doc.kind === "pdf") && doc.size <= THUMB_MAX_BYTES;
  const { data } = useDocumentContent(doc.id, seen && wants && doc.kind === "pdf");
  const image = useImageSource(doc, THUMB_IMAGE_MAX, seen && wants && doc.kind === "image");
  const url = useObjectUrl(image.data, image.mime);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!data || doc.kind !== "pdf" || !canvas.current) return;
    let cancelled = false;
    void import("@/lib/pdf").then(async ({ loadPdf, renderPage }) => {
      try {
        const pdf = await loadPdf(data);
        if (!cancelled && canvas.current) {
          await renderPage(pdf.doc, 1, canvas.current, 220);
          setPdfReady(true);
        }
        void pdf.destroy();
      } catch {
        // Fall back to the icon.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data, doc.kind]);

  return (
    <div
      ref={ref}
      className={`relative flex items-center justify-center overflow-hidden ${className ?? ""}`}
    >
      {url && !imgFailed ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover opacity-90"
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <KindIcon kind={doc.kind} className="h-8 w-8 text-fg-3" />
      )}
      {doc.kind === "pdf" && (
        <canvas
          ref={canvas}
          aria-hidden="true"
          className={`absolute top-0 left-0 grayscale-[30%] transition-opacity duration-300 ${pdfReady ? "opacity-85" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
