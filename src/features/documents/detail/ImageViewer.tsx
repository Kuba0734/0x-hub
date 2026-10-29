import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState, type WheelEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { strings } from "@/lib/strings";
import { useObjectUrl } from "@/lib/useObjectUrl";

const s = strings.documents;
const clamp = (v: number) => Math.min(6, Math.max(0.5, v));

/** Zoom (wheel / buttons) and pan (drag) using transforms only. */
export function ImageViewer({ data, mime }: { data: ArrayBuffer; mime: string }) {
  const url = useObjectUrl(data, mime);
  const target = useMotionValue(1);
  const scale = useSpring(target, { stiffness: 380, damping: 32 });
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [zoomPct, setZoomPct] = useState(100);

  useEffect(() => target.on("change", (v) => setZoomPct(Math.round(v * 100))), [target]);

  const zoomBy = (f: number) => target.set(clamp(target.get() * f));
  const reset = () => {
    target.set(1);
    x.set(0);
    y.set(0);
  };
  const onWheel = (e: WheelEvent) => zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-center gap-1 border-b border-line py-2">
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Minus />}
          aria-label={s.zoomOut}
          onClick={() => zoomBy(1 / 1.25)}
        />
        <span className="tabular w-12 text-center text-[12px] text-fg-2">{zoomPct}%</span>
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Plus />}
          aria-label={s.zoomIn}
          onClick={() => zoomBy(1.25)}
        />
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<RotateCcw />}
          aria-label={s.resetZoom}
          onClick={reset}
        />
      </div>
      <div
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        onWheel={onWheel}
        onDoubleClick={reset}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") zoomBy(1.25);
          if (e.key === "-") zoomBy(1 / 1.25);
          if (e.key === "0") reset();
        }}
      >
        {url && (
          <motion.img
            src={url}
            alt=""
            draggable={false}
            drag
            dragMomentum={false}
            style={{ scale, x, y }}
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-6"
          />
        )}
      </div>
    </div>
  );
}
