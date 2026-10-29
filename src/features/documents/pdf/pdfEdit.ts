import type { NormRect, PageOp, StampRequest } from "@/lib/ipc";

/** A page in the editor, keyed so it keeps its identity while being reordered. */
export interface EditPage {
  key: string;
  /** 0-based page in the source PDF. */
  source: number;
  /** Extra clockwise rotation in degrees. */
  rotate: number;
  removed: boolean;
}

export interface PlacedStamp {
  key: string;
  pageKey: string;
  signatureId: string;
  rect: NormRect;
}

export interface EditState {
  pages: EditPage[];
  stamps: PlacedStamp[];
}

export function initialState(pageCount: number): EditState {
  return {
    pages: Array.from({ length: pageCount }, (_, i) => ({
      key: `p${i}`,
      source: i,
      rotate: 0,
      removed: false,
    })),
    stamps: [],
  };
}

export const normalizeRotation = (deg: number) => (((deg % 360) + 360) % 360) as number;

export function isDirty(s: EditState): boolean {
  return (
    s.stamps.length > 0 ||
    s.pages.some((p, i) => p.source !== i || p.removed || normalizeRotation(p.rotate) !== 0)
  );
}

/** The backend request: kept pages in order, stamps addressed by output page index. */
export function toRequest(s: EditState): { pages: PageOp[]; stamps: StampRequest[] } {
  const kept = s.pages.filter((p) => !p.removed);
  const index = new Map(kept.map((p, i) => [p.key, i]));
  return {
    pages: kept.map((p) => ({ source: p.source, rotate: normalizeRotation(p.rotate) })),
    stamps: s.stamps.flatMap((st) => {
      const page = index.get(st.pageKey);
      return page === undefined ? [] : [{ page, signatureId: st.signatureId, rect: st.rect }];
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

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Keeps a rectangle fully on the page, preserving its size where possible. */
export function fitRect(r: NormRect): NormRect {
  const w = Math.min(1, Math.max(0.02, r.w));
  const h = Math.min(1, Math.max(0.01, r.h));
  return { w, h, x: Math.min(1 - w, Math.max(0, r.x)), y: Math.min(1 - h, Math.max(0, r.y)) };
}

/**
 * A new stamp in the lower middle of the page, 30% of the page wide, with the signature's
 * aspect ratio on a page of `pageAspect` (width / height).
 */
export function newStampRect(sigW: number, sigH: number, pageAspect: number): NormRect {
  const w = 0.3;
  const h = w * (sigH / Math.max(1, sigW)) * pageAspect;
  return fitRect({ x: 0.35, y: 0.72, w, h });
}
