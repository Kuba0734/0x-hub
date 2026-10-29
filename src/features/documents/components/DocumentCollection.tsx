import { AnimatePresence } from "motion/react";
import type { MenuItem } from "@/components/glass";
import type { Category, DocumentItem } from "@/lib/ipc";
import type { SelectModifiers } from "../selection/useSelection";
import { DocumentCard } from "./DocumentCard";
import { DocumentRow } from "./DocumentRow";

interface Props {
  docs: DocumentItem[];
  view: "grid" | "list";
  categories: Map<string, Category>;
  menuFor: (doc: DocumentItem) => MenuItem[];
  fresh: Set<string>;
  selected: Set<string>;
  onSelect: (id: string, mods: SelectModifiers) => void;
}

/** The visible documents as a grid of cards or a list of rows, with selection. */
export function DocumentCollection({
  docs,
  view,
  categories,
  menuFor,
  fresh,
  selected,
  onSelect,
}: Props) {
  const selecting = selected.size > 0;
  const common = (d: DocumentItem) => ({
    doc: d,
    category: d.categoryId ? categories.get(d.categoryId) : undefined,
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
