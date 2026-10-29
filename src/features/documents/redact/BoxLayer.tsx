import { useRef, useState, type PointerEvent } from "react";
import { X } from "lucide-react";
import type { NormRect } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { clamp01 } from "../pdf/pdfEdit";

const s = strings.redact;
/** Boxes smaller than this (fraction of the page) are treated as accidental clicks. */
const MIN_SIZE = 0.004;

interface Props {
  boxes: { key: string; rect: NormRect }[];
  onAdd: (rect: NormRect) => void;
  onRemove: (key: string) => void;
}

const pct = (r: NormRect) => ({
  left: `${r.x * 100}%`,
  top: `${r.y * 100}%`,
  width: `${r.w * 100}%`,
  height: `${r.h * 100}%`,
});

/** Drag on the page to cover an area; covered areas show as solid black like the export. */
export function BoxLayer({ boxes, onAdd, onRemove }: Props) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<NormRect | null>(null);

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01((e.clientY - r.top) / r.height),
    };
  };
  const rectFrom = (a: { x: number; y: number }, b: { x: number; y: number }): NormRect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  return (
    <div
      className="absolute inset-0 cursor-crosshair touch-none"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = at(e);
        setDraft(null);
      }}
      onPointerMove={(e) => start.current && setDraft(rectFrom(start.current, at(e)))}
      onPointerUp={(e) => {
        if (!start.current) return;
        const r = rectFrom(start.current, at(e));
        start.current = null;
        setDraft(null);
        if (r.w > MIN_SIZE && r.h > MIN_SIZE) onAdd(r);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDraft(null);
      }}
    >
      {boxes.map((b) => (
        <div key={b.key} style={pct(b.rect)} className="group absolute bg-black">
          <button
            type="button"
            aria-label={s.removeBox}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(b.key)}
            className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full border border-white/60 bg-black text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {draft && <div style={pct(draft)} className="absolute border border-white/80 bg-black/70" />}
    </div>
  );
}
