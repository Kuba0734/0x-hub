import { AnimatePresence } from "motion/react";
import type { MenuItem } from "@/components/glass";
import type { PointerEvent } from "react";
import type { DocumentItem } from "@/lib/ipc";
import type { SelectModifiers } from "../selection/useSelection";
import { DocumentCard } from "./DocumentCard";
import { DocumentRow } from "./DocumentRow";

interface Props {
  docs: DocumentItem[];
  view: "grid" | "list";
  /** Folder path shown on each document (when browsing results from all folders). */
  folderLabel?: (doc: DocumentItem) => string;
  /** Starts dragging this document (and the selection it belongs to) onto a folder. */
  onDragStart?: (e: PointerEvent, doc: DocumentItem) => void;
  menuFor: (doc: DocumentItem) => MenuItem[];
  fresh: Set<string>;
  selected: Set<string>;
  onSelect: (id: string, mods: SelectModifiers) => void;
}

/** The visible documents as a grid of cards or a list of rows, with selection. */
export function DocumentCollection({
  docs,
  view,
  folderLabel,
  onDragStart,
  menuFor,
  fresh,
  selected,
  onSelect,
}: Props) {
  const selecting = selected.size > 0;
  const common = (d: DocumentItem) => ({
    doc: d,
    folderLabel: folderLabel?.(d),
    onPointerDown: onDragStart ? (e: PointerEvent) => onDragStart(e, d) : undefined,
    menu: menuFor(d),
    fresh: fresh.has(d.id),
    selected: selected.has(d.id),
    selecting,
    onSelect: (mods: SelectModifiers) => onSelect(d.id, mods),
  });

  if (view === "list")
    return (
      <div className="flex flex-col">
        <AnimatePresence initial={false}>
          {docs.map((d) => (
            <DocumentRow key={d.id} {...common(d)} />
          ))}
        </AnimatePresence>
      </div>
    );
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      <AnimatePresence initial={false}>
        {docs.map((d) => (
          <DocumentCard key={d.id} {...common(d)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
