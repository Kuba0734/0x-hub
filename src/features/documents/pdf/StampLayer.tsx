import { useRef, type PointerEvent } from "react";
import { X } from "lucide-react";
import type { NormRect } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { SignatureImage } from "@/features/signatures/SignatureImage";
import { fitRect, type PlacedStamp } from "./pdfEdit";

const s = strings.pdfTools;

interface Props {
  stamps: PlacedStamp[];
  onChange: (key: string, rect: NormRect) => void;
  onRemove: (key: string) => void;
}

interface Drag {
  key: string;
  mode: "move" | "resize";
  x: number;
  y: number;
  start: NormRect;
}

/** Placed signatures over the displayed page: drag to move, corner to resize (keeps aspect). */
export function StampLayer({ stamps, onChange, onRemove }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const begin = (e: PointerEvent, st: PlacedStamp, mode: Drag["mode"]) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { key: st.key, mode, x: e.clientX, y: e.clientY, start: st.rect };
  };

  const move = (e: PointerEvent) => {
    const d = drag.current;
    const box = layer.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.x) / box.width;
    const dy = (e.clientY - d.y) / box.height;
    if (d.mode === "move") {
      onChange(d.key, fitRect({ ...d.start, x: d.start.x + dx, y: d.start.y + dy }));
    } else {
      const w = Math.max(0.04, d.start.w + dx);
      const h = d.start.h * (w / d.start.w);
      onChange(d.key, fitRect({ ...d.start, w, h }));
    }
  };

  const end = () => (drag.current = null);

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0">
      {stamps.map((st) => (
        <div
          key={st.key}
          role="group"
          aria-label={s.placed(1)}
          tabIndex={0}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 0.02 : 0.005;
            const r = st.rect;
            const moves: Record<string, [number, number]> = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            };
            const m = moves[e.key];
            if (m) {
              e.preventDefault();
              onChange(st.key, fitRect({ ...r, x: r.x + m[0], y: r.y + m[1] }));
            }
            if (e.key === "Delete" || e.key === "Backspace") onRemove(st.key);
          }}
          onPointerDown={(e) => begin(e, st, "move")}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          style={{
            left: `${st.rect.x * 100}%`,
            top: `${st.rect.y * 100}%`,
            width: `${st.rect.w * 100}%`,
            height: `${st.rect.h * 100}%`,
          }}
          className="group pointer-events-auto absolute cursor-move rounded-sm outline-1 outline-black/40 outline-dashed hover:outline-black/70 focus-visible:outline-2 focus-visible:outline-black"
        >
          <SignatureImage id={st.signatureId} paper={false} className="h-full w-full" />
          <button
            type="button"
            aria-label={s.removeStamp}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(st.key)}
            className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <span
            role="presentation"
            aria-label={s.resizeStamp}
            onPointerDown={(e) => begin(e, st, "resize")}
            onPointerMove={move}
            onPointerUp={end}
            className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-full border border-white bg-black"
          />
        </div>
      ))}
    </div>
  );
}
