import type { DocumentItem } from "@/lib/ipc";
import { allTags, applyFilters, defaultFilters, isSearching } from "./filters";

const base: DocumentItem = {
  id: "",
  title: "",
  filename: "",
  mime: "",
  kind: "pdf",
  size: 0,
  folderId: null,
  tags: [],
  description: "",
  expiresOn: null,
  reminderOffsets: [],
  pinned: false,
  ocrStatus: "none",
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
  linkedNoteIds: [],
  locked: false,
  revealed: false,
};

const docs: DocumentItem[] = [
  {
    ...base,
    id: "a",
    title: "Passport",
    folderId: "ids",
    tags: ["travel"],
    expiresOn: "2026-01-20",
    updatedAt: 1,
  },
  {
    ...base,
    id: "b",
    title: "Car insurance",
    folderId: "insurance",
    expiresOn: "2025-12-01",
    updatedAt: 3,
    size: 9,
  },
  {
    ...base,
    id: "c",
    title: "Tax 2025",
    folderId: "taxes",
    tags: ["2025", "travel"],
    updatedAt: 2,
    pinned: true,
  },
];

const today = new Date(2026, 0, 1);

describe("applyFilters", () => {
  it("keeps pinned first, then sorts", () => {
    expect(applyFilters(docs, defaultFilters, today).map((d) => d.id)).toEqual(["c", "b", "a"]);
    expect(
      applyFilters(docs, { ...defaultFilters, sort: "title" }, today).map((d) => d.id),
    ).toEqual(["c", "b", "a"]);
    expect(
      applyFilters(docs, { ...defaultFilters, sort: "expiry" }, today).map((d) => d.id),
    ).toEqual(["c", "b", "a"]);
  });

  it("filters by tag, text and expiry", () => {
    expect(
      applyFilters(docs, { ...defaultFilters, tag: "travel" }, today).map((d) => d.id),
    ).toEqual(["c", "a"]);
    expect(
      applyFilters(docs, { ...defaultFilters, text: "INSUR" }, today).map((d) => d.id),
    ).toEqual(["b"]);
    expect(
      applyFilters(docs, { ...defaultFilters, expiry: "soon" }, today).map((d) => d.id),
    ).toEqual(["a"]);
    expect(
      applyFilters(docs, { ...defaultFilters, expiry: "expired" }, today).map((d) => d.id),
    ).toEqual(["b"]);
    expect(
      applyFilters(docs, { ...defaultFilters, expiry: "none" }, today).map((d) => d.id),
    ).toEqual(["c"]);
  });

  it("searches across folders only when a filter is set", () => {
    expect(isSearching(defaultFilters)).toBe(false);
    expect(isSearching({ ...defaultFilters, sort: "title" })).toBe(false);
    expect(isSearching({ ...defaultFilters, text: " a " })).toBe(true);
    expect(isSearching({ ...defaultFilters, tag: "travel" })).toBe(true);
    expect(isSearching({ ...defaultFilters, expiry: "soon" })).toBe(true);
  });

  it("collects tags", () => {
    expect(allTags(docs)).toEqual(["2025", "travel"]);
  });
});
