import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Pin } from "lucide-react";
import { GlassContextMenu, type MenuItem } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import { formatBytes, relativeTime } from "@/lib/format";
import type { Category, DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { ExpiryBadge } from "./ExpiryBadge";
import { KindIcon } from "./Thumbnail";

interface Props {
  doc: DocumentItem;
  category?: Category;
  menu: MenuItem[];
  fresh?: boolean;
}

export function DocumentRow({ doc, category, menu, fresh }: Props) {
  const navigate = useNavigate();
  return (
    <motion.div
      layout
      initial={fresh ? { opacity: 0, x: -30 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring}
    >
      <GlassContextMenu items={menu} label={doc.title}>
        <button
          type="button"
          onClick={() => navigate(`/documents/${doc.id}`)}
          className="grid w-full grid-cols-[28px_minmax(0,1fr)_160px_140px_90px_100px] items-center gap-4 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-white/[0.05]"
        >
          <KindIcon kind={doc.kind} className="h-5 w-5 text-fg-2" />
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] text-fg">{doc.title}</span>
            {doc.pinned && (
              <Pin className="h-3 w-3 shrink-0 text-fg-2" aria-label={strings.common.pinned} />
            )}
          </span>
          <span className="truncate text-fg-2">
            {category?.name ?? strings.documents.uncategorized}
          </span>
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
