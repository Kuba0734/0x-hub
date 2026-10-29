import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Pin } from "lucide-react";
import { GlassCard, GlassContextMenu, type MenuItem } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import { formatBytes } from "@/lib/format";
import type { Category, DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { ExpiryBadge } from "./ExpiryBadge";
import { Thumbnail } from "./Thumbnail";

interface Props {
  doc: DocumentItem;
  category?: Category;
  menu: MenuItem[];
  /** Freshly imported: pops in with a spring as if it flew into the grid. */
  fresh?: boolean;
}

export function DocumentCard({ doc, category, menu, fresh }: Props) {
  const navigate = useNavigate();
  return (
    <motion.div
      layout
      initial={fresh ? { opacity: 0, scale: 0.6, y: -60 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={spring}
    >
      <GlassContextMenu items={menu} label={doc.title}>
        <GlassCard
          hoverable
          role="link"
          tabIndex={0}
          aria-label={doc.title}
          onClick={() => navigate(`/documents/${doc.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(`/documents/${doc.id}`);
          }}
          className="flex cursor-pointer flex-col overflow-hidden"
        >
          <Thumbnail doc={doc} className="h-32 border-b border-line bg-black/30" />
          <div className="flex flex-col gap-1.5 p-3.5">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-normal">
                {doc.title}
              </h3>
              {doc.pinned && (
                <Pin
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-2"
                  aria-label={strings.common.pinned}
                />
              )}
            </div>
            <p className="truncate text-[12px] text-fg-3">
              {category?.name ?? strings.documents.uncategorized} · {formatBytes(doc.size)}
            </p>
            {doc.expiresOn && <ExpiryBadge date={doc.expiresOn} className="self-start" />}
          </div>
        </GlassCard>
      </GlassContextMenu>
    </motion.div>
  );
}
