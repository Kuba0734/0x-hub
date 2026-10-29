import { daysUntil } from "@/lib/format";
import type { DocumentItem } from "@/lib/ipc";

export type ExpiryFilter = "all" | "soon" | "expired" | "none";
export type SortKey = "updated" | "title" | "expiry" | "size";

export interface DocFilters {
  text: string;
  categoryId: string | "all" | "none";
  tag: string | null;
  expiry: ExpiryFilter;
  sort: SortKey;
}

export const defaultFilters: DocFilters = {
  text: "",
  categoryId: "all",
  tag: null,
  expiry: "all",
  sort: "updated",
};

function matchesExpiry(d: DocumentItem, f: ExpiryFilter, today: Date): boolean {
  if (f === "all") return true;
  if (f === "none") return !d.expiresOn;
  if (!d.expiresOn) return false;
  const days = daysUntil(d.expiresOn, today);
  return f === "expired" ? days < 0 : days >= 0 && days <= 30;
}

/** Client-side filtering and sorting over the decrypted list. Pinned items come first. */
export function applyFilters(
  docs: DocumentItem[],
  f: DocFilters,
  today: Date = new Date(),
): DocumentItem[] {
  const text = f.text.trim().toLowerCase();
  const out = docs.filter((d) => {
    if (
      f.categoryId === "none"
        ? d.categoryId !== null
        : f.categoryId !== "all" && d.categoryId !== f.categoryId
    )
      return false;
    if (f.tag && !d.tags.includes(f.tag)) return false;
    if (!matchesExpiry(d, f.expiry, today)) return false;
    if (text) {
      const hay = `${d.title} ${d.filename} ${d.tags.join(" ")} ${d.description}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });

  const cmp: Record<SortKey, (a: DocumentItem, b: DocumentItem) => number> = {
    updated: (a, b) => b.updatedAt - a.updatedAt,
    title: (a, b) => a.title.localeCompare(b.title),
    size: (a, b) => b.size - a.size,
    expiry: (a, b) => {
      if (a.expiresOn === b.expiresOn) return 0;
      if (!a.expiresOn) return 1;
      if (!b.expiresOn) return -1;
      return a.expiresOn.localeCompare(b.expiresOn);
    },
  };
  return out.sort((a, b) => Number(b.pinned) - Number(a.pinned) || cmp[f.sort](a, b));
}

export function allTags(docs: DocumentItem[]): string[] {
  return [...new Set(docs.flatMap((d) => d.tags))].sort();
}
