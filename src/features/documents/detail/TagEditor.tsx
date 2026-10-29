import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { X } from "lucide-react";
import { springSnappy } from "@/components/motion/presets";
import { strings } from "@/lib/strings";

export function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-stroke bg-white/[0.04] p-1.5">
      <AnimatePresence initial={false}>
        {tags.map((t) => (
          <motion.span
            key={t}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={springSnappy}
            className="flex h-6 items-center gap-1 rounded-full bg-white/[0.1] pr-1 pl-2.5 text-[12px]"
          >
            #{t}
            <button
              type="button"
              aria-label={`${strings.common.remove} ${t}`}
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="flex h-4 w-4 items-center justify-center rounded-full text-fg-3 hover:bg-white/20 hover:text-fg"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        aria-label={strings.documents.addTag}
        placeholder={tags.length ? "" : strings.documents.tagPlaceholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={add}
        className="h-6 min-w-24 flex-1 bg-transparent px-1.5 text-[13px] text-fg placeholder:text-fg-3 focus-visible:outline-none"
      />
    </div>
  );
}
