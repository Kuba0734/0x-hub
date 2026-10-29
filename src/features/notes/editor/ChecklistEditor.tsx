import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { spring } from "@/components/motion/presets";
import { AnimatedCheck } from "@/components/ui/AnimatedCheck";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { ChecklistItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";

const s = strings.notes;
const newId = () => crypto.randomUUID();

export function ChecklistEditor({
  items,
  onChange,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const done = items.filter((i) => i.done).length;

  const set = (id: string, patch: Partial<ChecklistItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, { id: newId(), text: draft.trim(), done: false }]);
    setDraft("");
  };

  // Open items first, completed ones sink to the bottom with a layout animation.
  const ordered = [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];

  return (
    <div className="mx-auto flex h-full max-w-[640px] flex-col px-8 py-6">
      <div className="mb-5 flex items-center gap-3">
        <ProgressBar
          value={items.length ? done / items.length : 0}
          label={s.progress(done, items.length)}
          className="flex-1"
        />
        <span className="tabular text-[12px] text-fg-2">{s.progress(done, items.length)}</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        <AnimatePresence initial={false}>
          {ordered.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={spring}
              className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[0.04]"
            >
              <AnimatedCheck
                checked={item.done}
                onChange={(d) => set(item.id, { done: d })}
                label={item.text || s.itemPlaceholder}
              />
              <input
                aria-label={s.itemPlaceholder}
                value={item.text}
                onChange={(e) => set(item.id, { text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !item.text)
                    onChange(items.filter((i) => i.id !== item.id));
                }}
                className={`min-w-0 flex-1 bg-transparent text-[14px] transition-colors duration-300 focus-visible:outline-none ${
                  item.done ? "text-fg-3 line-through" : "text-fg"
                }`}
              />
              <button
                type="button"
                aria-label={s.removeItem}
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                className="flex h-6 w-6 items-center justify-center rounded-full text-fg-3 opacity-0 group-hover:opacity-100 hover:text-fg focus-visible:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <form
        className="mt-2 flex items-center gap-3 px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Plus className="h-5 w-5 text-fg-3" />
        <input
          aria-label={s.addItem}
          placeholder={s.addItem}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 bg-transparent text-[14px] text-fg placeholder:text-fg-3 focus-visible:outline-none"
          autoFocus={items.length === 0}
        />
      </form>
    </div>
  );
}
