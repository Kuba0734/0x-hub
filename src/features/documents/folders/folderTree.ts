import type { DocumentItem, Folder } from "@/lib/ipc";

/** Must match `MAX_DEPTH` in src-tauri/src/db/folders.rs. */
export const MAX_FOLDER_DEPTH = 8;

export interface FolderTree {
  byId: Map<string, Folder>;
  /** Children per parent id ("" = top level), already sorted by the backend. */
  children: Map<string, Folder[]>;
}

export function buildTree(folders: Folder[]): FolderTree {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const children = new Map<string, Folder[]>();
  for (const f of folders) {
    // A parent that no longer exists (shouldn't happen) shows the folder at the top level.
    const key = f.parentId && byId.has(f.parentId) ? f.parentId : "";
    const list = children.get(key) ?? [];
    list.push(f);
    children.set(key, list);
  }
  return { byId, children };
}

export function childrenOf(tree: FolderTree, id: string | null): Folder[] {
  return tree.children.get(id ?? "") ?? [];
}

/** Ancestors from the top level down to `id`, including it. Empty for the top level. */
export function pathTo(tree: FolderTree, id: string | null): Folder[] {
  const out: Folder[] = [];
  let cur = id ? tree.byId.get(id) : undefined;
  while (cur && out.length <= MAX_FOLDER_DEPTH) {
    out.unshift(cur);
    cur = cur.parentId ? tree.byId.get(cur.parentId) : undefined;
  }
  return out;
}

/** `id` and every folder below it. */
export function subtreeIds(tree: FolderTree, id: string): Set<string> {
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    for (const c of childrenOf(tree, stack.pop() ?? null)) {
      if (!out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

/** Height of the subtree under `id` (no subfolders = 1). */
function height(tree: FolderTree, id: string): number {
  return 1 + Math.max(0, ...childrenOf(tree, id).map((c) => height(tree, c.id)));
}

/** Depth-first list with indentation levels, for pickers. */
export function flatten(tree: FolderTree): { folder: Folder; depth: number }[] {
  const out: { folder: Folder; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const f of childrenOf(tree, parent)) {
      out.push({ folder: f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/**
 * Where folder `moving` may go: not into itself or its subfolders, not where it already
 * is, and not so deep that it would exceed the nesting limit. `null` = top level.
 */
export function canMoveFolder(tree: FolderTree, moving: string, target: string | null): boolean {
  const f = tree.byId.get(moving);
  if (!f || (f.parentId ?? null) === target) return false;
  if (target && subtreeIds(tree, moving).has(target)) return false;
  return pathTo(tree, target).length + height(tree, moving) <= MAX_FOLDER_DEPTH;
}

/** Documents in `id` and all its subfolders (trash excluded by the caller's list). */
export function countDeep(tree: FolderTree, id: string): number {
  let n = 0;
  for (const fid of subtreeIds(tree, id)) n += tree.byId.get(fid)?.documentCount ?? 0;
  return n;
}

/** Documents directly in `folderId` (null = top level). */
export function docsIn(docs: DocumentItem[], folderId: string | null): DocumentItem[] {
  return docs.filter((d) => (d.folderId ?? null) === folderId);
}

/** "Contracts / Car" style label for a folder. */
export function pathLabel(tree: FolderTree, id: string | null): string {
  return pathTo(tree, id)
    .map((f) => f.name)
    .join(" / ");
}
