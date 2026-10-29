import { daysUntil, toIsoDate } from "@/lib/format";
import type { DocumentItem, Note } from "@/lib/ipc";

export type Item =
  | { type: "document"; id: string; title: string; updatedAt: number; doc: DocumentItem }
  | { type: "note"; id: string; title: string; updatedAt: number; note: Note };

export function toItems(docs: DocumentItem[], notes: Note[]): Item[] {
  return [
    ...docs.map((d) => ({
      type: "document" as const,
      id: d.id,
      title: d.title,
      updatedAt: d.updatedAt,
      doc: d,
    })),
    ...notes.map((n) => ({
      type: "note" as const,
      id: n.id,
      title: n.title,
      updatedAt: n.updatedAt,
      note: n,
    })),
  ];
}

export function recent(items: Item[], n = 6): Item[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, n);
}

export function pinned(items: Item[]): Item[] {
  return items.filter((i) => (i.type === "document" ? i.doc.pinned : i.note.pinned));
}

export interface TimelineEntry {
  doc: DocumentItem;
  days: number;
  /** "expiry" for the expiry date itself, otherwise a reminder N days before. */
  kind: "expiry" | "reminder";
  date: string;
}

/** Expiries and reminder dates in the next `horizon` days, soonest first. */
export function upcoming(
  docs: DocumentItem[],
  today: Date = new Date(),
  horizon = 90,
): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const doc of docs) {
    if (!doc.expiresOn) continue;
    const days = daysUntil(doc.expiresOn, today);
    if (days >= 0 && days <= horizon) out.push({ doc, days, kind: "expiry", date: doc.expiresOn });
    for (const off of doc.reminderOffsets) {
      const rd = days - off;
      if (rd >= 0 && rd <= horizon && off > 0) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + rd);
        out.push({ doc, days: rd, kind: "reminder", date: toIsoDate(d) });
      }
    }
  }
  return out.sort((a, b) => a.days - b.days || (a.kind === "expiry" ? -1 : 1)).slice(0, 12);
}
