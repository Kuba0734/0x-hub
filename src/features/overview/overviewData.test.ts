import type { DocumentItem } from "@/lib/ipc";
import { upcoming } from "./overviewData";

const doc = (id: string, expiresOn: string | null, reminderOffsets: number[]): DocumentItem => ({
  id,
  title: id,
  filename: "",
  mime: "",
  kind: "pdf",
  size: 0,
  folderId: null,
  tags: [],
  description: "",
  expiresOn,
  reminderOffsets,
  pinned: false,
  ocrStatus: "none",
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
  linkedNoteIds: [],
  locked: false,
  revealed: false,
});

describe("upcoming", () => {
  it("lists expiries and reminders inside the horizon, soonest first", () => {
    const today = new Date(2026, 0, 1);
    const list = upcoming(
      [doc("a", "2026-01-31", [30, 7]), doc("b", "2027-01-01", [30]), doc("c", null, [])],
      today,
    );
    expect(list.map((e) => `${e.doc.id}:${e.kind}:${e.days}`)).toEqual([
      "a:reminder:0",
      "a:reminder:23",
      "a:expiry:30",
    ]);
  });
});
