import { describe, expect, it } from "vitest";
import {
  fitRect,
  initialState,
  isDirty,
  newStampRect,
  reorder,
  rotate,
  toggleRemoved,
  toRequest,
} from "./pdfEdit";

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

  it("addresses stamps by output page and drops stamps on removed pages", () => {
    let s = initialState(3);
    const rect = { x: 0.1, y: 0.1, w: 0.2, h: 0.1 };
    s = {
      ...s,
      stamps: [
        { key: "a", pageKey: "p2", signatureId: "sig", rect },
        { key: "b", pageKey: "p0", signatureId: "sig", rect },
      ],
    };
    s = toggleRemoved(s, "p0");
    expect(toRequest(s).stamps).toEqual([{ page: 1, signatureId: "sig", rect }]);
  });

  it("keeps rectangles on the page", () => {
    expect(fitRect({ x: 0.9, y: -0.2, w: 0.3, h: 0.1 })).toEqual({ x: 0.7, y: 0, w: 0.3, h: 0.1 });
    const r = newStampRect(300, 100, 0.75);
    expect(r.w).toBe(0.3);
    expect(r.h).toBeCloseTo(0.075);
  });
});
