import { useCallback, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { NormRect } from "@/lib/ipc";
import { cn } from "@/lib/format";
import { strings } from "@/lib/strings";
import { useElementSize } from "@/lib/useElementSize";
import { SignatureImage } from "@/features/signatures/SignatureImage";
import { fitRect, type PlacedItem } from "./pdfEdit";
import { TextItem } from "./TextItem";
import { useItemDrag } from "./useItemDrag";

const s = strings.pdfTools;

interface Props {
  items: PlacedItem[];
  /** Displayed page height in points (for font sizes). */
  heightPt: number;
  onPatch: (key: string, patch: Partial<PlacedItem>) => void;
  onRemove: (key: string) => void;
}

/** Same geometry the PDF gets (see `pdf/marks.rs`), in a y-down unit square. */
function MarkGlyph({ kind }: { kind: "check" | "cross" }) {
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      {kind === "check" ? (
        <polyline
          points="0.15,0.5 0.4,0.78 0.85,0.2"
          fill="none"
          stroke="black"
          strokeWidth={0.12}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M0.18 0.18 L0.82 0.82 M0.18 0.82 L0.82 0.18"
          stroke="black"
          strokeWidth={0.12}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

const labels: Record<PlacedItem["kind"], string> = {
  signature: s.signatureItem,
  text: s.textItem,
  check: s.checkItem,
  cross: s.crossItem,
  cover: s.coverItem,
};

/** Placed items over the displayed page: drag to move, corner to resize, arrows to nudge. */
export function ItemLayer({ items, heightPt, onPatch, onRemove }: Props) {
  const [layerRef, layer] = useElementSize<HTMLDivElement>();
  const box = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      box.current = el;
      layerRef(el);
    },
    [layerRef],
  );
  const changeRect = useCallback(
    (key: string, rect: NormRect) => onPatch(key, { rect }),
    [onPatch],
  );
  const { begin, track } = useItemDrag(box, changeRect);

  const boxItem = (item: Exclude<PlacedItem, { kind: "text" }>, child: ReactNode) => {
    const keepAspect = item.kind !== "cover";
    return (
      <div
        key={item.key}
        role="group"
        data-item
        aria-label={labels[item.kind]}
        tabIndex={0}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.02 : 0.004;
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
          };
          const m = moves[e.key];
          const r = item.rect;
          if (m) {
            e.preventDefault();
            changeRect(item.key, fitRect({ ...r, x: r.x + m[0], y: r.y + m[1] }));
          }
          if (e.key === "Delete" || e.key === "Backspace") onRemove(item.key);
        }}
        onPointerDown={(e) => begin(e, item.key, item.rect, "move")}
        {...track}
        style={{
          left: `${item.rect.x * 100}%`,
          top: `${item.rect.y * 100}%`,
          width: `${item.rect.w * 100}%`,
          height: `${item.rect.h * 100}%`,
        }}
        className={cn(
          "group pointer-events-auto absolute cursor-move rounded-[2px] outline-1 outline-dashed hover:outline-black/70 focus-visible:outline-2 focus-visible:outline-black",
          item.kind === "cover" ? "bg-white outline-black/40" : "outline-black/30",
        )}
      >
        {child}
        <button
          type="button"
          aria-label={s.removeItem}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(item.key)}
          className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <span
          role="presentation"
          onPointerDown={(e) => begin(e, item.key, item.rect, "resize", keepAspect)}
          {...track}
          className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-full border border-white bg-black"
        />
      </div>
    );
  };

  return (
    <div ref={setRef} className="pointer-events-none absolute inset-0">
      {items.map((item) => {
        switch (item.kind) {
          case "text":
            return (
              <TextItem
                key={item.key}
                item={item}
                layer={layer}
                heightPt={heightPt}
                onPatch={(patch) => onPatch(item.key, patch)}
                onRemove={() => onRemove(item.key)}
                onDragStart={(e) => begin(e, item.key, item.rect, "move")}
                dragTrack={track}
              />
            );
          case "signature":
            return boxItem(
              item,
              <SignatureImage id={item.signatureId} paper={false} className="h-full w-full" />,
            );
          case "check":
          case "cross":
            return boxItem(item, <MarkGlyph kind={item.kind} />);
          case "cover":
            return boxItem(item, null);
        }
      })}
    </div>
  );
}
