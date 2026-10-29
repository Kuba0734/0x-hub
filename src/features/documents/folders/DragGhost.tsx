import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { Files } from "lucide-react";
import { springSnappy } from "@/components/motion/presets";
import { strings } from "@/lib/strings";
import type { DocDragState } from "./useDocumentDrag";

const s = strings.documents.folders;

/** The chip that follows the pointer while documents are dragged onto a folder. */
export function DragGhost({
  drag,
  targetName,
}: {
  drag: DocDragState | null;
  targetName?: string;
}) {
  return createPortal(
    <AnimatePresence>
      {drag && (
        <motion.div
          key="ghost"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={springSnappy}
          style={{ x: drag.x + 14, y: drag.y + 14 }}
          className="pointer-events-none fixed top-0 left-0 z-[60] flex items-center gap-2 rounded-full border border-white/20 bg-black/85 px-3 py-1.5 text-[12px] text-fg shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
          aria-hidden="true"
        >
          <Files className="h-3.5 w-3.5" />
          <span>
            {drag.over !== undefined && targetName
              ? s.dropHint(targetName)
              : drag.docs.length === 1
                ? drag.docs[0]?.title
                : s.dragging(drag.docs.length)}
          </span>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
