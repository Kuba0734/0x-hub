import { useState } from "react";
import { Folder as FolderIcon, FolderOpen, Home } from "lucide-react";
import { GlassButton, GlassDialog } from "@/components/glass";
import { cn } from "@/lib/format";
import { strings } from "@/lib/strings";
import { flatten, type FolderTree } from "./folderTree";

const s = strings.documents.folders;

interface Props {
  open: boolean;
  title: string;
  tree: FolderTree;
  /** Targets that can't be chosen (e.g. a folder's own subtree). `null` = top level. */
  isAllowed?: (target: string | null) => boolean;
  onClose: () => void;
  /** `label` is the folder path for messages. */
  onPick: (target: string | null, label: string) => void;
}

/** "Move to…": the whole folder tree as an indented list, plus the top level. */
export function FolderPicker({
  open,
  title,
  tree,
  isAllowed = () => true,
  onClose,
  onPick,
}: Props) {
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const rows = [
    { id: null as string | null, name: s.topLevel, depth: 0 },
    ...flatten(tree).map(({ folder, depth }) => ({
      id: folder.id,
      name: folder.name,
      depth: depth + 1,
    })),
  ];
  const close = () => {
    setChosen(undefined);
    onClose();
  };
  const label = (id: string | null) =>
    id === null ? s.topLevel : (rows.find((r) => r.id === id)?.name ?? "");

  return (
    <GlassDialog
      open={open}
      onClose={close}
      title={title}
      width={440}
      footer={
        <>
          <GlassButton variant="ghost" onClick={close}>
            {strings.common.cancel}
          </GlassButton>
          <GlassButton
            variant="primary"
            disabled={chosen === undefined}
            onClick={() => {
              if (chosen === undefined) return;
              onPick(chosen, label(chosen));
              close();
            }}
          >
            {s.pick}
          </GlassButton>
        </>
      }
    >
      <div role="listbox" aria-label={s.pickTitle} className="flex max-h-[50vh] flex-col gap-0.5">
        {rows.map((r) => {
          const allowed = isAllowed(r.id);
          const active = chosen === r.id;
          const Icon = r.id === null ? Home : active ? FolderOpen : FolderIcon;
          return (
            <button
              key={r.id ?? "top"}
              type="button"
              role="option"
              aria-selected={active}
              disabled={!allowed}
              onClick={() => setChosen(r.id)}
              onDoubleClick={() => {
                if (!allowed) return;
                onPick(r.id, label(r.id));
                close();
              }}
              style={{ paddingLeft: 10 + r.depth * 18 }}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2.5 rounded-xl pr-3 text-left text-[13px] transition-colors",
                active ? "bg-white text-black" : "text-fg hover:bg-white/[0.06]",
                !allowed && "pointer-events-none opacity-35",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{r.name}</span>
            </button>
          );
        })}
      </div>
    </GlassDialog>
  );
}
