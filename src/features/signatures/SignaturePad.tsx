import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent } from "react";
import { strings } from "@/lib/strings";

export interface SignaturePadHandle {
  clear: () => void;
  /** PNG of the strokes on transparency, or null when nothing was drawn. */
  toPng: () => Promise<Uint8Array | null>;
}

interface Props {
  onChange?: (empty: boolean) => void;
}

/** White "paper" to sign on with mouse, pen or touch. Strokes are drawn as smooth curves. */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { onChange },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const drawn = useRef(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = el.clientWidth * dpr;
    el.height = el.clientHeight * dpr;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
  }, []);

  const point = (e: PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const stroke = (e: PointerEvent) => {
    const ctx = canvas.current?.getContext("2d");
    const from = last.current;
    if (!ctx || !from) return;
    const to = point(e);
    // Pens report pressure; mouse and touch get a steady line.
    const pressure = e.pointerType === "pen" ? e.pressure : 0.5;
    ctx.lineWidth = 1.2 + pressure * 2.6;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(from.x, from.y, mid.x, mid.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    last.current = to;
    if (!drawn.current) {
      drawn.current = true;
      onChange?.(false);
    }
  };

  useImperativeHandle(ref, () => ({
    clear: () => {
      const el = canvas.current;
      el?.getContext("2d")?.clearRect(0, 0, el.width, el.height);
      drawn.current = false;
      onChange?.(true);
    },
    toPng: async () => {
      const el = canvas.current;
      if (!el || !drawn.current) return null;
      const blob = await new Promise<Blob | null>((res) => el.toBlob(res, "image/png"));
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    },
  }));

  return (
    <div className="relative">
      <canvas
        ref={canvas}
        role="img"
        aria-label={strings.signatures.padLabel}
        className="h-48 w-full cursor-crosshair touch-none rounded-2xl bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          last.current = point(e);
        }}
        onPointerMove={stroke}
        onPointerUp={() => (last.current = null)}
        onPointerCancel={() => (last.current = null)}
      />
      <span className="pointer-events-none absolute inset-x-8 bottom-10 border-b border-black/15" />
    </div>
  );
});
