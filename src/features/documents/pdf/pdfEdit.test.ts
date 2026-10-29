import { describe, expect, it } from "vitest";
import {
  addItem,
  fitRect,
  initialState,
  isDirty,
  newMarkRect,
  newStampRect,
  removeItem,
  reorder,
  rotate,
  stepFontSize,
  toggleRemoved,
  toRequest,
  updateItem,
} from "./pdfEdit";

const rect = { x: 0.1, y: 0.1, w: 0.2, h: 0.1 };

describe("pdf edit state", () => {
  it("starts clean and maps to the identity request", () => {
    const s = initialState(3);
    expect(isDirty(s)).toBe(false);
    expect(toRequest(s).pages).toEqual([
      { source: 0, rotate: 0 },
      { source: 1, rotate: 0 },
      { source: 2, rotate: 0 },
    ]);
  });

  it("reorders, rotates and removes pages", () => {
    let s = initialState(3);
    s = reorder(s, ["p2", "p0", "p1"]);
    s = rotate(s, "p2", -90);
    s = toggleRemoved(s, "p1");
    expect(isDirty(s)).toBe(true);
    expect(toRequest(s).pages).toEqual([
      { source: 2, rotate: 270 },
      { source: 0, rotate: 0 },
    ]);
    // A full turn is no change.
    expect(isDirty(rotate(rotate(initialState(1), "p0", 180), "p0", 180))).toBe(false);
  });

  it("ignores reorders that lose pages", () => {
    const s = initialState(2);
    expect(reorder(s, ["p1"])).toBe(s);
  });

  it("addresses items by output page and drops items on removed pages", () => {
    let s = initialState(3);
    s = addItem(s, { key: "a", pageKey: "p2", rect, kind: "signature", signatureId: "sig" });
    s = addItem(s, { key: "b", pageKey: "p0", rect, kind: "check" });
    s = addItem(s, { key: "c", pageKey: "p2", rect, kind: "text", text: "Hi", fontSize: 0.02 });
    s = toggleRemoved(s, "p0");
    expect(toRequest(s).items).toEqual([
      { page: 1, rect, kind: "signature", signatureId: "sig" },
      { page: 1, rect, kind: "text", text: "Hi", fontSize: 0.02 },
    ]);
  });

  it("treats empty text as nothing", () => {
    let s = addItem(initialState(1), {
      key: "t",
      pageKey: "p0",
      rect,
      kind: "text",
      text: "  ",
      fontSize: 0.02,
    });
    expect(isDirty(s)).toBe(false);
    expect(toRequest(s).items).toEqual([]);
    s = updateItem(s, "t", { text: "Berlin" });
    expect(isDirty(s)).toBe(true);
    expect(removeItem(s, "t").items).toEqual([]);
  });

  it("keeps rectangles on the page", () => {
    expect(fitRect({ x: 0.9, y: -0.2, w: 0.3, h: 0.1 })).toEqual({ x: 0.7, y: 0, w: 0.3, h: 0.1 });
    const r = newStampRect(300, 100, 0.75);
    expect(r.w).toBe(0.3);
    expect(r.h).toBeCloseTo(0.075);
    // Check marks are square on the page.
    const c = newMarkRect("check", 0.7);
    expect(c.h).toBeCloseTo(c.w * 0.7);
  });

  it("steps through the offered font sizes", () => {
    expect(stepFontSize(12, 1)).toBe(14);
    expect(stepFontSize(12, -1)).toBe(10);
    expect(stepFontSize(32, 1)).toBe(32);
    expect(stepFontSize(8, -1)).toBe(8);
    expect(stepFontSize(11, 1)).toBe(12);
  });
});
