import { useEffect, useState } from "react";
import type { LoadedPdf, PDFDocumentProxy } from "@/lib/pdf";

/** Loads decrypted PDF bytes with pdf.js (lazily imported) and frees them on unmount. */
export function usePdfDocument(data: ArrayBuffer | undefined) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!data) return;
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
      setPdf(null);
      void loaded?.destroy();
    };
  }, [data]);

  return { pdf, failed };
}
