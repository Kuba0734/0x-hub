import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Lock, Pin } from "lucide-react";
import { GlassContextMenu, type MenuItem } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import { AnimatedCheck } from "@/components/ui/AnimatedCheck";
import { cn, formatBytes, relativeTime } from "@/lib/format";
import type { PointerEvent } from "react";
import type { DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import type { SelectableProps } from "./DocumentCard";
import { ExpiryBadge } from "./ExpiryBadge";
import { KindIcon } from "./Thumbnail";

interface Props extends SelectableProps {
  doc: DocumentItem;
  /** Folder path, shown when results come from several folders. */
  folderLabel?: string;
  /** Begins a drag onto a folder (see useDocumentDrag). */
  onPointerDown?: (e: PointerEvent) => void;
  menu: MenuItem[];
  fresh?: boolean;
}

export function DocumentRow({
  doc,
  folderLabel,
  onPointerDown,
  menu,
  fresh,
  selected,
  selecting,
  onSelect,
}: Props) {
  const navigate = useNavigate();
  return (
    <motion.div
      layout
      initial={fresh ? { opacity: 0, x: -30 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring}
      className="group flex items-center gap-2"
    >
      <div
        className={cn(
          "transition-opacity",
          selected || selecting
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        )}
      >
        <AnimatedCheck
          checked={selected}
          label={`${strings.documents.select}: ${doc.title}`}
          onChange={() => onSelect({ shiftKey: false, ctrlKey: true, metaKey: false })}
        />
      </div>
      <GlassContextMenu items={menu} label={doc.title} className="min-w-0 flex-1">
        <button
          type="button"
          aria-pressed={selecting ? selected : undefined}
          onPointerDown={onPointerDown}
          onClick={(e) =>
            e.ctrlKey || e.metaKey || e.shiftKey || selecting
              ? onSelect(e)
              : navigate(`/documents/${doc.id}`)
          }
          className={cn(
            "grid w-full grid-cols-[28px_minmax(0,1fr)_160px_140px_90px_100px] items-center gap-4 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-white/[0.05]",
            selected && "bg-white/[0.08]",
          )}
        >
          <KindIcon kind={doc.kind} className="h-5 w-5 text-fg-2" />
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] text-fg">{doc.title}</span>
            {doc.locked && (
              <Lock
                className="h-3 w-3 shrink-0 text-fg-2"
                aria-label={strings.documents.lockedLabel}
              />
            )}
            {doc.pinned && (
              <Pin className="h-3 w-3 shrink-0 text-fg-2" aria-label={strings.common.pinned} />
            )}
          </span>
          <span className="truncate text-fg-2">{folderLabel ?? "—"}</span>
          <span>
            {doc.expiresOn ? (
              <ExpiryBadge date={doc.expiresOn} />
            ) : (
              <span className="text-fg-3">—</span>
            )}
          </span>
          <span className="tabular text-fg-3">{formatBytes(doc.size)}</span>
          <span className="text-fg-3">{relativeTime(doc.updatedAt)}</span>
        </button>
      </GlassContextMenu>
    </motion.div>
  );
}
