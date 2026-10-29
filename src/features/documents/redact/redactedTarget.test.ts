import { describe, expect, it } from "vitest";
import { redactedTarget } from "./redactedTarget";

describe("redactedTarget", () => {
  it("keeps PDFs and PNGs, turns other images into JPEG", () => {
    const base = { title: "ID card", filename: "id.front.pdf", kind: "pdf" as const, mime: "" };
    expect(redactedTarget(base)).toEqual({ name: "id.front (redacted).pdf", ext: "pdf" });
    expect(
      redactedTarget({ ...base, filename: "scan.png", kind: "image", mime: "image/png" }).ext,
    ).toBe("png");
    expect(
      redactedTarget({ ...base, filename: "IMG_1.HEIC", kind: "image", mime: "image/heic" }),
    ).toEqual({ name: "IMG_1 (redacted).jpg", ext: "jpg" });
  });
});
