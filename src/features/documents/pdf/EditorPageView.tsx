import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { GlassButton } from "@/components/glass";
import type { PDFDocumentProxy } from "@/lib/pdf";
import { strings } from "@/lib/strings";
import { useElementSize } from "@/lib/useElementSize";
import { ItemLayer } from "./ItemLayer";
import type { EditPage, PlacedItem } from "./pdfEdit";
import { PageCanvas } from "./PageCanvas";

const s = strings.documents;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
/** Padding around the page inside the scroll area, in px. */
const PAD = 8;

interface Props {
  pdf: PDFDocumentProxy;
  page: EditPage;
  items: PlacedItem[];
  aspect: number;
  heightPt: number;
  onPatch: (key: string, patch: Partial<PlacedItem>) => void;
  onRemove: (key: string) => void;
}

/**
 * The page being edited. Wheel zooms around the cursor (100 % = fit), dragging the page
 * pans; items keep their own drag. The canvas stretches at once and re-renders sharp.
 */
export function EditorPageView({ pdf, page, items, aspect, heightPt, onPatch, onRemove }: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const setBox = useCallback(
    (el: HTMLDivElement | null) => {
      box.current = el;
      sizeRef(el);
    },
    [sizeRef],
  );
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  const anchor = useRef<{ fx: number; fy: number; ox: number; oy: number } | null>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const fit = Math.max(120, Math.min(size.width - PAD * 2, (size.height - PAD * 2) * aspect));
  const width = Math.floor(fit * zoom);

  const zoomTo = useCallback((next: number, clientX?: number, clientY?: number) => {
    const el = box.current;
    const z = clampZoom(next);
    if (!el || z === zoomRef.current) return;
    const r = el.getBoundingClientRect();
    const ox = clientX === undefined ? el.clientWidth / 2 : clientX - r.left;
    const oy = clientY === undefined ? el.clientHeight / 2 : clientY - r.top;
    anchor.current ??= {
      fx: (el.scrollLeft + ox) / el.scrollWidth,
      fy: (el.scrollTop + oy) / el.scrollHeight,
      ox,
      oy,
    };
    zoomRef.current = z;
    setZoom(z);
  }, []);

  // Keep the point under the cursor in place once the new size is laid out.
  useLayoutEffect(() => {
    const el = box.current;
    const a = anchor.current;
    anchor.current = null;
    if (!el || !a) return;
    el.scrollLeft = a.fx * el.scrollWidth - a.ox;
    el.scrollTop = a.fy * el.scrollHeight - a.oy;
  }, [zoom]);

  // Native, non-passive listener so the wheel zooms instead of scrolling the dialog.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTo(zoomRef.current * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  const startPan = (e: PointerEvent<HTMLDivElement>) => {
    // Items (signatures, text, marks) handle their own pointer input.
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-item]")) return;
    const el = e.currentTarget;
    pan.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const movePan = (e: PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    e.currentTarget.scrollLeft = p.left - (e.clientX - p.x);
    e.currentTarget.scrollTop = p.top - (e.clientY - p.y);
  };
  const endPan = () => (pan.current = null);

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={setBox}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest("[data-item]")) zoomTo(1);
        }}
        className="absolute inset-0 cursor-grab overflow-auto active:cursor-grabbing"
      >
        <div
          className="flex min-h-full min-w-full items-center justify-center"
          style={{ padding: PAD }}
        >
          <div className="relative shrink-0" style={{ width }}>
            <PageCanvas
              pdf={pdf}
              page={page.source + 1}
              rotation={page.rotate}
              width={width}
              className="h-auto! w-full! rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
            />
            {!page.removed && (
              <ItemLayer
                // Remount per page so text boxes re-seed their content.
                key={page.key}
                items={items}
                heightPt={heightPt}
                onPatch={onPatch}
                onRemove={onRemove}
              />
            )}
          </div>
        </div>
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-0.5 rounded-full bg-black/80 p-0.5">
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Minus />}
          aria-label={s.zoomOut}
          disabled={zoom <= MIN_ZOOM}
          onClick={() => zoomTo(zoom / 1.25)}
        />
        <span className="tabular w-11 text-center text-[11px] text-fg-2">
          {Math.round(zoom * 100)}%
        </span>
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Plus />}
          aria-label={s.zoomIn}
          disabled={zoom >= MAX_ZOOM}
          onClick={() => zoomTo(zoom * 1.25)}
        />
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Maximize />}
          aria-label={s.resetZoom}
          disabled={zoom === 1}
          onClick={() => zoomTo(1)}
        />
      </div>
    </div>
  );
}
