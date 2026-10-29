import { useEffect, useRef, type PointerEvent } from "react";
import { GripVertical, Minus, Plus, X } from "lucide-react";
import type { NormRect } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { stepFontSize, type PlacedItem } from "./pdfEdit";

const s = strings.pdfTools;

type TextItemData = Extract<PlacedItem, { kind: "text" }>;

interface Props {
  item: TextItemData;
  /** Rendered page size in CSS pixels. */
  layer: { width: number; height: number };
  /** Displayed page height in points, to show and step font sizes in pt. */
  heightPt: number;
  onPatch: (patch: { text?: string; fontSize?: number; rect?: NormRect }) => void;
  onRemove: () => void;
  onDragStart: (e: PointerEvent) => void;
  dragTrack: Record<string, (e: PointerEvent) => void>;
}

const tool =
  "flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-1 focus-visible:outline-white";

/**
 * Text typed straight onto the page. Arial at line-height 1.2 matches the Helvetica the
 * PDF gets, so what you see is where the text lands. No wrapping: Enter starts a new line.
 */
export function TextItem({
  item,
  layer,
  heightPt,
  onPatch,
  onRemove,
  onDragStart,
  dragTrack,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const fontPx = item.fontSize * layer.height;
  const pt = Math.round(item.fontSize * heightPt);

  // Seed the editable once; afterwards the DOM owns the text (keeps the caret in place).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerText = item.text;
    if (!item.text) el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The box grows with its text; keep the stored rect in sync for selection and limits.
  useEffect(() => {
    const el = box.current;
    if (!el || !layer.width || !layer.height) return;
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth / layer.width;
      const h = el.offsetHeight / layer.height;
      if (Math.abs(w - item.rect.w) > 0.002 || Math.abs(h - item.rect.h) > 0.002)
        onPatch({ rect: { ...item.rect, w, h } });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [layer.width, layer.height, item.rect, onPatch]);

  const setPt = (next: number) => onPatch({ fontSize: next / heightPt });
  const keep = (e: PointerEvent) => e.preventDefault(); // toolbar clicks keep the caret

  return (
    <div
      data-item
      className="group pointer-events-auto absolute"
      style={{ left: `${item.rect.x * 100}%`, top: `${item.rect.y * 100}%` }}
    >
      <div
        role="toolbar"
        aria-label={s.textTools}
        className="absolute -top-9 left-0 flex items-center gap-0.5 rounded-full bg-black/90 px-1 py-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <span
          role="button"
          tabIndex={-1}
          aria-label={s.moveItem}
          onPointerDown={(e) => {
            keep(e);
            onDragStart(e);
          }}
          {...dragTrack}
          className={`${tool} cursor-move`}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <button
          type="button"
          aria-label={s.smaller}
          onPointerDown={keep}
          onClick={() => setPt(stepFontSize(pt, -1))}
          className={tool}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="tabular w-9 text-center text-[11px] text-white">{s.pt(pt)}</span>
        <button
          type="button"
          aria-label={s.larger}
          onPointerDown={keep}
          onClick={() => setPt(stepFontSize(pt, 1))}
          className={tool}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={s.removeItem}
          onPointerDown={keep}
          onClick={onRemove}
          className={tool}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        ref={box}
        role="textbox"
        aria-multiline="true"
        aria-label={s.textItem}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck={false}
        onInput={(e) => onPatch({ text: e.currentTarget.innerText.replace(/\n$/, "") })}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.blur();
        }}
        style={{ fontSize: fontPx }}
        className="min-w-[1ch] cursor-text font-[Arial,Helvetica,sans-serif] leading-[1.2] whitespace-pre text-black outline-1 outline-black/30 outline-dashed hover:outline-black/60 focus:outline-black"
      />
    </div>
  );
}
