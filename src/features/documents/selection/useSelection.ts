import { useCallback, useState } from "react";

export interface SelectModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Explorer-style selection: click toggles, Shift+click selects a range in `order`. */
export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);

  const select = useCallback(
    (id: string, order: string[], mods: Pick<SelectModifiers, "shiftKey">) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (mods.shiftKey && anchor && order.includes(anchor)) {
          const from = order.indexOf(anchor);
          const to = order.indexOf(id);
          order.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((x) => next.add(x));
        } else if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      if (!mods.shiftKey) setAnchor(id);
    },
    [anchor],
  );

  const selectAll = useCallback((ids: string[]) => setSelected(new Set(ids)), []);
  const clear = useCallback(() => {
    setSelected(new Set());
    setAnchor(null);
  }, []);

  return { selected, select, selectAll, clear, active: selected.size > 0 };
}
