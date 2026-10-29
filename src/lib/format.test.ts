import {
  daysUntil,
  dayPart,
  formatBytes,
  parseSnippet,
  relativeTime,
  toIsoDate,
  urgency,
} from "./format";
import { passwordScore } from "./password";

describe("formatBytes", () => {
  it("formats sizes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
  });
});

describe("dates", () => {
  const today = new Date(2026, 0, 10);
  it("counts calendar days", () => {
    expect(daysUntil("2026-01-10", today)).toBe(0);
    expect(daysUntil("2026-01-17", today)).toBe(7);
    expect(daysUntil("2026-01-01", today)).toBe(-9);
  });
  it("maps urgency", () => {
    expect(urgency(-1)).toBe("expired");
    expect(urgency(3)).toBe("critical");
    expect(urgency(20)).toBe("soon");
    expect(urgency(200)).toBe("later");
  });
  it("round-trips iso dates", () => {
    expect(toIsoDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
  it("names the time of day", () => {
    expect(dayPart(8)).toBe("morning");
    expect(dayPart(13)).toBe("afternoon");
    expect(dayPart(19)).toBe("evening");
    expect(dayPart(2)).toBe("night");
  });
  it("formats relative time", () => {
    expect(relativeTime(1000, 1000)).toBe("just now");
    expect(relativeTime(0, 2 * 3_600_000)).toBe("2 hours ago");
  });
});

describe("parseSnippet", () => {
  it("splits highlight markers", () => {
    expect(parseSnippet("a \u0002tax\u0003 b")).toEqual([
      { text: "a ", hit: false },
      { text: "tax", hit: true },
      { text: " b", hit: false },
    ]);
    expect(parseSnippet("plain")).toEqual([{ text: "plain", hit: false }]);
  });
});

describe("passwordScore", () => {
  it("ranks passwords", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("abc")).toBeLessThanOrEqual(1);
    expect(passwordScore("password123")).toBeLessThanOrEqual(1);
    expect(passwordScore("correct horse battery staple")).toBeGreaterThanOrEqual(3);
    expect(passwordScore("Tr0ub4dor&3-Xyz!long")).toBe(4);
  });
});
