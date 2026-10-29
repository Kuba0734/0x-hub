import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "@/lib/pdf";

const A4 = { aspect: 595 / 842, heightPt: 842 };

/** Displayed size of a page (with `extraRotation` added): aspect and height in points. */
export function usePageSize(pdf: PDFDocumentProxy | null, page: number, extraRotation: number) {
  const [size, setSize] = useState(A4);
  useEffect(() => {
    if (!pdf) return;
    let stale = false;
    void pdf
      .getPage(page)
      .then((p) => {
        const vp = p.getViewport({ scale: 1, rotation: (p.rotate + extraRotation + 720) % 360 });
        if (!stale) setSize({ aspect: vp.width / vp.height, heightPt: vp.height });
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [pdf, page, extraRotation]);
  return size;
}

/** Width / height of a page as displayed with `extraRotation` added. */
export function usePageAspect(pdf: PDFDocumentProxy | null, page: number, extraRotation: number) {
  return usePageSize(pdf, page, extraRotation).aspect;
}
