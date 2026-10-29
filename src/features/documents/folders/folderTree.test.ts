import { describe, expect, it } from "vitest";
import type { Folder } from "@/lib/ipc";
import {
  buildTree,
  canMoveFolder,
  childrenOf,
  countDeep,
  flatten,
  MAX_FOLDER_DEPTH,
  pathLabel,
  pathTo,
  subtreeIds,
} from "./folderTree";

const f = (id: string, parentId: string | null, documentCount = 0): Folder => ({
  id,
  parentId,
  name: id.toUpperCase(),
  sort: 0,
  createdAt: 0,
  documentCount,
});

// car ─ insurance ─ 2026
//     └ repairs
// taxes
const tree = buildTree([
  f("car", null, 1),
  f("insurance", "car", 2),
  f("2026", "insurance", 3),
  f("repairs", "car"),
  f("taxes", null, 4),
]);

describe("folder tree", () => {
  it("lists children and paths", () => {
    expect(childrenOf(tree, null).map((x) => x.id)).toEqual(["car", "taxes"]);
    expect(childrenOf(tree, "car").map((x) => x.id)).toEqual(["insurance", "repairs"]);
    expect(pathTo(tree, "2026").map((x) => x.id)).toEqual(["car", "insurance", "2026"]);
    expect(pathTo(tree, null)).toEqual([]);
    expect(pathLabel(tree, "2026")).toBe("CAR / INSURANCE / 2026");
  });

  it("flattens depth-first with levels", () => {
    expect(flatten(tree).map(({ folder, depth }) => `${depth}:${folder.id}`)).toEqual([
      "0:car",
      "1:insurance",
      "2:2026",
      "1:repairs",
      "0:taxes",
    ]);
  });

  it("collects subtrees and deep counts", () => {
    expect([...subtreeIds(tree, "car")].sort()).toEqual(["2026", "car", "insurance", "repairs"]);
    expect(countDeep(tree, "car")).toBe(6);
  });

  it("only allows sensible folder moves", () => {
    expect(canMoveFolder(tree, "car", "2026")).toBe(false); // into its own subfolder
    expect(canMoveFolder(tree, "car", "car")).toBe(false);
    expect(canMoveFolder(tree, "insurance", "car")).toBe(false); // already there
    expect(canMoveFolder(tree, "insurance", null)).toBe(true);
    expect(canMoveFolder(tree, "taxes", "2026")).toBe(true);
    // Depth limit: a chain at the limit can't take another level.
    const chain = buildTree(
      Array.from({ length: MAX_FOLDER_DEPTH }, (_, i) => f(`l${i}`, i ? `l${i - 1}` : null)).concat(
        f("x", null),
      ),
    );
    expect(canMoveFolder(chain, "x", `l${MAX_FOLDER_DEPTH - 1}`)).toBe(false);
    expect(canMoveFolder(chain, "x", `l${MAX_FOLDER_DEPTH - 2}`)).toBe(true);
  });

  it("puts folders with a missing parent at the top level", () => {
    const t = buildTree([f("orphan", "gone")]);
    expect(childrenOf(t, null).map((x) => x.id)).toEqual(["orphan"]);
  });
});
