import { ChevronRight, FolderPlus, Home } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { cn } from "@/lib/format";
import type { Folder } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { MAX_FOLDER_DEPTH } from "./folderTree";

const s = strings.documents.folders;

interface Props {
  path: Folder[];
  /** Folder id under a dragged document ("" = top level). */
  dropOver: string | undefined;
  onOpen: (id: string | null) => void;
  onNewFolder: () => void;
}

/** Where you are: All documents › … › current. Each crumb also takes dragged documents. */
export function FolderBreadcrumb({ path, dropOver, onOpen, onNewFolder }: Props) {
  const crumbs = [{ id: null as string | null, name: s.root }, ...path];
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1">
      <nav aria-label={s.breadcrumb} className="flex min-w-0 flex-wrap items-center gap-0.5">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const over = dropOver === (c.id ?? "");
          return (
            <span key={c.id ?? "root"} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-fg-3" aria-hidden />}
              <button
                type="button"
                data-folder-drop={c.id ?? ""}
                aria-current={last ? "page" : undefined}
                onClick={() => onOpen(c.id)}
                className={cn(
                  "flex h-8 max-w-[220px] items-center gap-1.5 rounded-full px-2.5 text-[13px] transition-colors",
                  last ? "font-semibold text-fg" : "text-fg-2 hover:bg-white/[0.06] hover:text-fg",
                  over && "bg-white text-black",
                )}
              >
                {i === 0 && <Home className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{c.name}</span>
              </button>
            </span>
          );
        })}
      </nav>
      <GlassButton
        size="sm"
        variant="ghost"
        icon={<FolderPlus />}
        className="ml-1"
        disabled={path.length >= MAX_FOLDER_DEPTH}
        onClick={onNewFolder}
      >
        {s.newFolder}
      </GlassButton>
    </div>
  );
}
