import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { CheckCheck, Download, Lock, Pin, Tag, Trash2, X } from "lucide-react";
import {
  GlassButton,
  GlassDialog,
  GlassInput,
  GlassPanel,
  GlassSelect,
  GlassTooltip,
} from "@/components/glass";
import { spring } from "@/components/motion/presets";
import type { Category, DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useBatchActions } from "./useBatchActions";

const s = strings.documents;

interface Props {
  docs: DocumentItem[];
  categories: Category[];
  onSelectAll: () => void;
  onClear: () => void;
}

function TagDialog({
  count,
  open,
  onClose,
  onAdd,
}: {
  count: number;
  open: boolean;
  onClose: () => void;
  onAdd: (tag: string) => void;
}) {
  const [tag, setTag] = useState("");
  const submit = () => {
    const t = tag.trim().replace(/^#/, "").toLowerCase();
    if (t) onAdd(t);
    setTag("");
    onClose();
  };
  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      title={s.tagDialogTitle(count)}
      width={380}
      footer={
        <>
          <GlassButton variant="ghost" onClick={onClose}>
            {strings.common.cancel}
          </GlassButton>
          <GlassButton variant="primary" onClick={submit} disabled={!tag.trim()}>
            {strings.common.add}
          </GlassButton>
        </>
      }
    >
      <GlassInput
        label={s.tags}
        hideLabel
        placeholder={s.tagPlaceholder}
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        data-autofocus
      />
    </GlassDialog>
  );
}

/** Floating glass bar with batch actions while documents are selected. */
export function SelectionBar({ docs, categories, onSelectAll, onClear }: Props) {
  const batch = useBatchActions();
  const [tagging, setTagging] = useState(false);
  const allPinned = docs.length > 0 && docs.every((d) => d.pinned);
  const after = (p: Promise<unknown>) => void p.then(onClear);

  return (
    <>
      <AnimatePresence>
        {docs.length > 0 && (
          <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
            <GlassPanel
              refract
              solid
              radius={20}
              role="toolbar"
              aria-label={s.selectionBar}
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={spring}
              className="pointer-events-auto flex items-center gap-1.5 py-2 pr-2 pl-4"
            >
              <span className="tabular mr-2 text-[13px] font-medium" aria-live="polite">
                {s.selected(docs.length)}
              </span>
              <GlassSelect<string>
                size="sm"
                label={s.moveTo}
                value=""
                onChange={(v) => v && after(batch.moveTo(docs, v === "none" ? "" : v))}
                options={[
                  { value: "", label: s.moveTo },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                  { value: "none", label: s.uncategorized },
                ]}
              />
              <GlassButton
                size="sm"
                variant="ghost"
                icon={<Tag />}
                onClick={() => setTagging(true)}
              >
                {s.addTagTo}
              </GlassButton>
              <GlassButton
                size="sm"
                variant="ghost"
                icon={<Pin />}
                onClick={() => after(batch.setPinned(docs, !allPinned))}
              >
                {allPinned ? strings.common.unpin : strings.common.pin}
              </GlassButton>
              <GlassButton
                size="sm"
                variant="ghost"
                icon={<Lock />}
                onClick={() => after(batch.lock(docs))}
              >
                {s.lockDocument}
              </GlassButton>
              <GlassButton
                size="sm"
                variant="ghost"
                icon={<Download />}
                onClick={() => void batch.exportTo(docs)}
              >
                {s.exportSelected}
              </GlassButton>
              <GlassButton
                size="sm"
                variant="ghost"
                icon={<Trash2 />}
                onClick={() => after(batch.trash(docs))}
              >
                {strings.common.moveToTrash}
              </GlassButton>
              <span className="mx-1 h-5 w-px bg-line" />
              <GlassTooltip label={s.selectAll}>
                <GlassButton
                  size="sm"
                  variant="ghost"
                  iconOnly
                  aria-label={s.selectAll}
                  icon={<CheckCheck />}
                  onClick={onSelectAll}
                />
              </GlassTooltip>
              <GlassTooltip label={s.clearSelection}>
                <GlassButton
                  size="sm"
                  variant="ghost"
                  iconOnly
                  aria-label={s.clearSelection}
                  icon={<X />}
                  onClick={onClear}
                />
              </GlassTooltip>
            </GlassPanel>
          </div>
        )}
      </AnimatePresence>
      <TagDialog
        count={docs.length}
        open={tagging}
        onClose={() => setTagging(false)}
        onAdd={(t) => after(batch.addTag(docs, t))}
      />
    </>
  );
}
