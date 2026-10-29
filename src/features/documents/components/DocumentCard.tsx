import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Lock, Pin } from "lucide-react";
import { GlassCard, GlassContextMenu, type MenuItem } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import { AnimatedCheck } from "@/components/ui/AnimatedCheck";
import { cn, formatBytes } from "@/lib/format";
import type { PointerEvent } from "react";
import type { DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useSettings } from "@/stores/settings";
import type { SelectModifiers } from "../selection/useSelection";
import { ExpiryBadge } from "./ExpiryBadge";
import { Thumbnail } from "./Thumbnail";

export interface SelectableProps {
  selected: boolean;
  /** Some document is selected: plain clicks toggle selection instead of opening. */
  selecting: boolean;
  onSelect: (mods: SelectModifiers) => void;
}

interface Props extends SelectableProps {
  doc: DocumentItem;
  /** Folder path, shown when results come from several folders. */
  folderLabel?: string;
  /** Begins a drag onto a folder (see useDocumentDrag). */
  onPointerDown?: (e: PointerEvent) => void;
  menu: MenuItem[];
  /** Freshly imported: pops in with a spring as if it flew into the grid. */
  fresh?: boolean;
}

export function DocumentCard({
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
  const blurPreviews = useSettings((st) => st.settings?.blurPreviews ?? true);
  const open = () => navigate(`/documents/${doc.id}`);

  return (
    <motion.div
      layout
      initial={fresh ? { opacity: 0, scale: 0.6, y: -60 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={spring}
      className="group relative"
    >
      <GlassContextMenu items={menu} label={doc.title}>
        <GlassCard
          hoverable
          role="link"
          tabIndex={0}
          aria-label={doc.title}
          aria-selected={selecting ? selected : undefined}
          onPointerDown={onPointerDown}
          onClick={(e) =>
            e.ctrlKey || e.metaKey || e.shiftKey || selecting ? onSelect(e) : open()
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") open();
            else if (e.key === " ") {
              e.preventDefault();
              onSelect(e);
            }
          }}
          className={cn(
            "flex cursor-pointer flex-col overflow-hidden",
            selected && "outline-2 outline-offset-2 outline-white/80",
          )}
        >
          <Thumbnail
            doc={doc}
            blurred={blurPreviews}
            className="h-32 border-b border-line bg-black/30"
          />
          <div className="flex flex-col gap-1.5 p-3.5">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-normal">
                {doc.title}
              </h3>
              {doc.locked && (
                <Lock
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-2"
                  aria-label={strings.documents.lockedLabel}
                />
              )}
              {doc.pinned && (
                <Pin
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-2"
                  aria-label={strings.common.pinned}
                />
              )}
            </div>
            <p className="truncate text-[12px] text-fg-3">
              {folderLabel ? `${folderLabel} · ` : ""}
              {formatBytes(doc.size)}
            </p>
            {doc.expiresOn && <ExpiryBadge date={doc.expiresOn} className="self-start" />}
          </div>
        </GlassCard>
      </GlassContextMenu>
      <div
        className={cn(
          "absolute top-2.5 left-2.5 z-10 rounded-md bg-black/50 transition-opacity duration-150",
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
    </motion.div>
  );
}
