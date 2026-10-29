import { motion } from "motion/react";
import { Folder as FolderIcon, FolderOpen } from "lucide-react";
import { GlassCard, GlassContextMenu, type MenuItem } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import { cn } from "@/lib/format";
import type { Folder } from "@/lib/ipc";
import { strings } from "@/lib/strings";

interface Props {
  folder: Folder;
  /** Documents in this folder and its subfolders. */
  deepCount: number;
  subfolders: number;
  menu: MenuItem[];
  /** A dragged document is over this folder. */
  dropActive: boolean;
  onOpen: () => void;
}

/** A folder tile: opens on click, takes dragged documents, right-click for actions. */
export function FolderCard({ folder, deepCount, subfolders, menu, dropActive, onOpen }: Props) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: dropActive ? 1.04 : 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={spring}
      data-folder-drop={folder.id}
    >
      <GlassContextMenu items={menu} label={folder.name}>
        <GlassCard
          hoverable
          role="link"
          tabIndex={0}
          aria-label={folder.name}
          onClick={onOpen}
          onKeyDown={(e) => e.key === "Enter" && onOpen()}
          className={cn(
            "flex cursor-pointer items-center gap-3 p-3.5 transition-[outline-color]",
            dropActive && "outline-2 outline-offset-2 outline-white",
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07]">
            {dropActive ? (
              <FolderOpen className="h-5 w-5 text-fg" strokeWidth={1.6} />
            ) : (
              <FolderIcon className="h-5 w-5 text-fg-2" strokeWidth={1.6} />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium">{folder.name}</span>
            <span className="block truncate text-[12px] text-fg-3">
              {strings.documents.folders.summary(deepCount, subfolders)}
            </span>
          </span>
        </GlassCard>
      </GlassContextMenu>
    </motion.div>
  );
}
