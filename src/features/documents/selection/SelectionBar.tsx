import { AnimatePresence } from "motion/react";
import { useState } from "react";
import {
  CheckCheck,
  Download,
  FileStack,
  FolderInput,
  Lock,
  Pin,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { GlassButton, GlassPanel, GlassTooltip } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import type { DocumentItem } from "@/lib/ipc";
import { FolderPicker } from "../folders/FolderPicker";
import type { FolderTree } from "../folders/folderTree";
import { strings } from "@/lib/strings";
import { CombineDialog } from "./CombineDialog";
import { TagDialog } from "./TagDialog";
import { useBatchActions } from "./useBatchActions";

const s = strings.documents;

interface Props {
  docs: DocumentItem[];
  tree: FolderTree;
  onSelectAll: () => void;
  onClear: () => void;
}

/** Floating glass bar with batch actions while documents are selected. */
export function SelectionBar({ docs, tree, onSelectAll, onClear }: Props) {
  const batch = useBatchActions();
  const [moving, setMoving] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [combining, setCombining] = useState(false);
  const allImages = docs.length > 0 && docs.every((d) => d.kind === "image");
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
              <GlassButton
                size="sm"
                variant="ghost"
                icon={<FolderInput />}
                onClick={() => setMoving(true)}
              >
                {s.moveTo}
              </GlassButton>
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
              <GlassTooltip label={allImages ? s.combineToPdf : strings.pdfTools.combineOnlyImages}>
                <GlassButton
                  size="sm"
                  variant="ghost"
                  icon={<FileStack />}
                  onClick={() => setCombining(true)}
                  disabled={!allImages}
                >
                  {s.combineToPdf}
                </GlassButton>
              </GlassTooltip>
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
      <FolderPicker
        open={moving}
        title={s.folders.moveDocs(docs.length)}
        tree={tree}
        onClose={() => setMoving(false)}
        onPick={(target, label) => after(batch.moveTo(docs, target ?? "", label))}
      />
      <CombineDialog
        docs={docs}
        open={combining}
        onClose={() => setCombining(false)}
        onDone={onClear}
      />
    </>
  );
}
