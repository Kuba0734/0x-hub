import { useEffect, useRef, useState } from "react";
import { EyeOff, File, Lock, FileImage, FileSpreadsheet, FileText, FileType } from "lucide-react";
import type { DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
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

/** Static (never animated) blur for privacy; scaled up so the soft edges stay inside the frame. */
const BLUR = "scale-110 blur-lg";

/**
 * In-memory thumbnail: images via object URL, PDFs by rendering page 1.
 * Generated lazily when visible; nothing is written to disk.
 * `blurred` hides the content until the document is opened.
 */
export function Thumbnail({
  doc,
  className,
  blurred = false,
}: {
  doc: DocumentItem;
  className?: string;
  blurred?: boolean;
}) {
  const { ref, seen } = useInView<HTMLDivElement>();
  // Locked documents never load content into the grid.
  const hidden = doc.locked && !doc.revealed;
  const wants =
    !hidden && (doc.kind === "image" || doc.kind === "pdf") && doc.size <= THUMB_MAX_BYTES;
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
      {hidden ? (
        <Lock className="h-7 w-7 text-fg-3" aria-label={strings.documents.lockedLabel} />
      ) : url && !imgFailed ? (
        <img
          src={url}
          alt=""
          className={`h-full w-full object-cover opacity-90 ${blurred ? BLUR : ""}`}
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
          className={`absolute top-0 left-0 grayscale-[30%] transition-opacity duration-300 ${pdfReady ? "opacity-85" : "opacity-0"} ${blurred ? BLUR : ""}`}
        />
      )}
      {blurred && ((url && !imgFailed) || pdfReady) && (
        <span
          aria-label={strings.documents.previewHidden}
          className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-fg-2"
        >
          <EyeOff className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}
