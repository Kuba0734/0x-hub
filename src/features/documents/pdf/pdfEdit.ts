import type { ItemRequest, NormRect, PageOp } from "@/lib/ipc";

/** A page in the editor, keyed so it keeps its identity while being reordered. */
export interface EditPage {
  key: string;
  /** 0-based page in the source PDF. */
  source: number;
  /** Extra clockwise rotation in degrees. */
  rotate: number;
  removed: boolean;
}

type Body<T> = T extends unknown ? Omit<T, "page" | "rect"> : never;
/** What an item is: signature, text (font size as a fraction of page height), mark, cover. */
export type ItemBody = Body<ItemRequest>;
export type ItemKind = ItemBody["kind"];

/** Something placed on a page in the editor. */
export type PlacedItem = ItemBody & { key: string; pageKey: string; rect: NormRect };

export interface EditState {
  pages: EditPage[];
  items: PlacedItem[];
}

export function initialState(pageCount: number): EditState {
  return {
    pages: Array.from({ length: pageCount }, (_, i) => ({
      key: `p${i}`,
      source: i,
      rotate: 0,
      removed: false,
    })),
    items: [],
  };
}

export const normalizeRotation = (deg: number) => (((deg % 360) + 360) % 360) as number;

const isEmptyText = (i: PlacedItem) => i.kind === "text" && !i.text.trim();

export function isDirty(s: EditState): boolean {
  return (
    s.items.some((i) => !isEmptyText(i)) ||
    s.pages.some((p, i) => p.source !== i || p.removed || normalizeRotation(p.rotate) !== 0)
  );
}

/** The backend request: kept pages in order, items addressed by output page index. */
export function toRequest(s: EditState): { pages: PageOp[]; items: ItemRequest[] } {
  const kept = s.pages.filter((p) => !p.removed);
  const index = new Map(kept.map((p, i) => [p.key, i]));
  return {
    pages: kept.map((p) => ({ source: p.source, rotate: normalizeRotation(p.rotate) })),
    items: s.items.flatMap((item) => {
      const page = index.get(item.pageKey);
      if (page === undefined || isEmptyText(item)) return [];
      const req: Record<string, unknown> = { ...item, page };
      delete req.key;
      delete req.pageKey;
      return [req as ItemRequest];
    }),
  };
}

export function reorder(s: EditState, keys: string[]): EditState {
  const byKey = new Map(s.pages.map((p) => [p.key, p]));
  const pages = keys.flatMap((k) => byKey.get(k) ?? []);
  return pages.length === s.pages.length ? { ...s, pages } : s;
}

export function rotate(s: EditState, key: string, delta: number): EditState {
  return {
    ...s,
    pages: s.pages.map((p) => (p.key === key ? { ...p, rotate: p.rotate + delta } : p)),
  };
}

export function toggleRemoved(s: EditState, key: string): EditState {
  return {
    ...s,
    pages: s.pages.map((p) => (p.key === key ? { ...p, removed: !p.removed } : p)),
  };
}

export function addItem(s: EditState, item: PlacedItem): EditState {
  return { ...s, items: [...s.items, item] };
}

export function updateItem(s: EditState, key: string, patch: Partial<PlacedItem>): EditState {
  return {
    ...s,
    items: s.items.map((i) => (i.key === key ? ({ ...i, ...patch } as PlacedItem) : i)),
  };
}

export function removeItem(s: EditState, key: string): EditState {
  return { ...s, items: s.items.filter((i) => i.key !== key) };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Keeps a rectangle fully on the page, preserving its size where possible. */
export function fitRect(r: NormRect): NormRect {
  const w = Math.min(1, Math.max(0.005, r.w));
  const h = Math.min(1, Math.max(0.005, r.h));
  return { w, h, x: Math.min(1 - w, Math.max(0, r.x)), y: Math.min(1 - h, Math.max(0, r.y)) };
}

/**
 * A new signature in the lower middle of the page, 30% of the page wide, with the
 * signature's aspect ratio on a page of `pageAspect` (width / height).
 */
export function newStampRect(sigW: number, sigH: number, pageAspect: number): NormRect {
  const w = 0.3;
  const h = w * (sigH / Math.max(1, sigW)) * pageAspect;
  return fitRect({ x: 0.35, y: 0.72, w, h });
}

/** Starting rectangle for a new mark; `n` staggers several new items so they don't stack. */
export function newMarkRect(kind: ItemKind, pageAspect: number, n = 0): NormRect {
  const shift = (n % 8) * 0.025;
  if (kind === "check" || kind === "cross") {
    const w = 0.035;
    return fitRect({ x: 0.45 + shift, y: 0.45 + shift, w, h: w * pageAspect });
  }
  if (kind === "cover") return fitRect({ x: 0.35 + shift, y: 0.45 + shift, w: 0.3, h: 0.04 });
  // Text: the size follows the content; this is only the starting point.
  return fitRect({ x: 0.1 + shift, y: 0.2 + shift, w: 0.2, h: 0.02 });
}

/** Font sizes offered in the editor, in points. */
export const FONT_SIZES_PT = [8, 10, 12, 14, 18, 24, 32] as const;
export const DEFAULT_FONT_PT = 12;

/** Next larger/smaller offered size from the current one. */
export function stepFontSize(currentPt: number, dir: 1 | -1): number {
  const sizes = [...FONT_SIZES_PT];
  if (dir > 0) return sizes.find((s) => s > currentPt + 0.25) ?? sizes[sizes.length - 1]!;
  return [...sizes].reverse().find((s) => s < currentPt - 0.25) ?? sizes[0]!;
}
