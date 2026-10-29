import { Reorder } from "motion/react";
import { RotateCcw, RotateCw, Trash2, Undo2 } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import { cn } from "@/lib/format";
import type { PDFDocumentProxy } from "@/lib/pdf";
import { strings } from "@/lib/strings";
import { PageCanvas } from "./PageCanvas";
import type { EditPage } from "./pdfEdit";

const s = strings.pdfTools;
const THUMB_WIDTH = 92;

interface Props {
  pdf: PDFDocumentProxy;
  pages: EditPage[];
  selected: string;
  onSelect: (key: string) => void;
  onReorder: (keys: string[]) => void;
  onRotate: (key: string, delta: number) => void;
  onToggleRemoved: (key: string) => void;
}

/** Horizontal filmstrip of pages: drag to reorder, buttons to rotate or remove. */
export function PageStrip({
  pdf,
  pages,
  selected,
  onSelect,
  onReorder,
  onRotate,
  onToggleRemoved,
}: Props) {
  return (
    <Reorder.Group
      axis="x"
      values={pages.map((p) => p.key)}
      onReorder={onReorder}
      className="flex gap-3 overflow-x-auto px-1 pt-1 pb-3"
    >
      {pages.map((p, i) => (
        <Reorder.Item
          key={p.key}
          value={p.key}
          transition={spring}
          whileDrag={{ scale: 1.04 }}
          className="group relative shrink-0 cursor-grab active:cursor-grabbing"
        >
          <button
            type="button"
            onClick={() => onSelect(p.key)}
            aria-label={s.pageLabel(i + 1)}
            aria-pressed={selected === p.key}
            className={cn(
              "flex h-[132px] w-[104px] items-center justify-center rounded-xl border p-1.5 transition-[opacity,border-color]",
              selected === p.key ? "border-white/70" : "border-line hover:border-white/25",
              p.removed && "opacity-35",
            )}
          >
            <PageCanvas
              pdf={pdf}
              page={p.source + 1}
              rotation={p.rotate}
              width={THUMB_WIDTH}
              className="pointer-events-none max-h-full rounded-sm"
            />
          </button>
          <span className="tabular pointer-events-none absolute top-2 left-2 rounded-full bg-black/70 px-1.5 text-[11px] text-fg">
            {i + 1}
          </span>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full bg-black/85 p-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <GlassButton
              size="sm"
              iconOnly
              icon={<RotateCcw />}
              aria-label={s.rotateLeft}
              onClick={() => onRotate(p.key, -90)}
              disabled={p.removed}
            />
            <GlassButton
              size="sm"
              iconOnly
              icon={<RotateCw />}
              aria-label={s.rotateRight}
              onClick={() => onRotate(p.key, 90)}
              disabled={p.removed}
            />
            <GlassButton
              size="sm"
              iconOnly
              icon={p.removed ? <Undo2 /> : <Trash2 />}
              aria-label={p.removed ? s.restorePage : s.removePage}
              onClick={() => onToggleRemoved(p.key)}
            />
          </div>
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}
