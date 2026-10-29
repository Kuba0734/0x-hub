import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "@/lib/pdf";

/** Width / height of a page as displayed with `extraRotation` added. */
export function usePageAspect(pdf: PDFDocumentProxy | null, page: number, extraRotation: number) {
  const [aspect, setAspect] = useState(1 / Math.SQRT2);
  useEffect(() => {
    if (!pdf) return;
    let stale = false;
    void pdf
      .getPage(page)
      .then((p) => {
        const vp = p.getViewport({ scale: 1, rotation: (p.rotate + extraRotation + 720) % 360 });
        if (!stale) setAspect(vp.width / vp.height);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [pdf, page, extraRotation]);
  return aspect;
}
