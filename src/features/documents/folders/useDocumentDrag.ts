import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { DocumentItem } from "@/lib/ipc";

/** Pixels the pointer must travel before a press becomes a drag (clicks stay clicks). */
const THRESHOLD = 6;

export interface DocDragState {
  docs: DocumentItem[];
  x: number;
  y: number;
  /** Folder id under the pointer ("" = top level), or undefined over nothing. */
  over: string | undefined;
}

/** Drop targets mark themselves with `data-folder-drop="<folder id>"` ("" = top level). */
function targetAt(x: number, y: number): string | undefined {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-folder-drop]");
  return el?.dataset.folderDrop;
}

/** Swallows the click that follows a drag, so dropping never opens the document. */
function swallowNextClick() {
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
}

/**
 * Drag documents onto folders with the pointer (Tauri's file-drop handling disables HTML5
 * drag and drop in the WebView). `start` goes on a card's onPointerDown.
 */
export function useDocumentDrag(onDrop: (docs: DocumentItem[], target: string) => void) {
  const [state, setState] = useState<DocDragState | null>(null);
  const drop = useRef(onDrop);
  useEffect(() => {
    drop.current = onDrop;
  }, [onDrop]);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  const start = useCallback((e: PointerEvent, docs: DocumentItem[]) => {
    if (e.button !== 0 || docs.length === 0) return;
    // Controls inside a card (selection checkbox, fields) keep their own behaviour.
    if ((e.target as HTMLElement).closest("input, [role=checkbox], [data-no-drag]")) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let dragging = false;
    let over: string | undefined;

    const move = (ev: globalThis.PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < THRESHOLD) return;
        dragging = true;
        document.body.style.userSelect = "none";
      }
      over = targetAt(ev.clientX, ev.clientY);
      // Dropping where every dragged document already is would do nothing.
      if (over !== undefined && docs.every((d) => (d.folderId ?? "") === over)) over = undefined;
      setState({ docs, x: ev.clientX, y: ev.clientY, over });
    };
    const end = () => {
      cleanup.current?.();
      if (!dragging) return;
      swallowNextClick();
      setState(null);
      if (over !== undefined) drop.current(docs, over);
    };
    const cancel = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      over = undefined;
      end();
    };
    cleanup.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("keydown", cancel);
      document.body.style.userSelect = "";
      cleanup.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("keydown", cancel);
  }, []);

  return { state, start };
}
