import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy };

export interface LoadedPdf {
  doc: PDFDocumentProxy;
  /** Frees the worker-side document. */
  destroy: () => Promise<void>;
}

/** Loads a PDF from decrypted bytes (copied, because pdf.js transfers the buffer). */
export async function loadPdf(data: ArrayBuffer): Promise<LoadedPdf> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
  const doc = await task.promise;
  return { doc, destroy: () => task.destroy() };
}

/** Renders a page into `canvas` at `cssWidth` pixels wide (HiDPI aware). */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
) {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const dpr = window.devicePixelRatio || 1;
  const scale = (cssWidth / base.width) * dpr;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${viewport.height / dpr}px`;
  await page.render({ canvas, viewport }).promise;
}
