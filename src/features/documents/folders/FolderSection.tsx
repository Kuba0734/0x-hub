import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { FolderInput, FolderOpen, Pencil, Trash2 } from "lucide-react";
import type { MenuItem } from "@/components/glass";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Folder } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { FolderBreadcrumb } from "./FolderBreadcrumb";
import { FolderCard } from "./FolderCard";
import { FolderNameDialog } from "./FolderNameDialog";
import { FolderPicker } from "./FolderPicker";
import { canMoveFolder, childrenOf, countDeep, pathTo, type FolderTree } from "./folderTree";
import { useFolderActions } from "./useFolderActions";

const s = strings.documents.folders;

type Dialog =
  | { kind: "new" }
  | { kind: "rename"; folder: Folder }
  | { kind: "move"; folder: Folder }
  | { kind: "delete"; folder: Folder };

interface Props {
  tree: FolderTree;
  current: string | null;
  /** Folder id under a dragged document ("" = top level). */
  dropOver: string | undefined;
  /** Hide the folder tiles (e.g. while searching across all folders). */
  showFolders: boolean;
  onOpen: (id: string | null) => void;
}

/** Path bar, the subfolders of the current folder, and folder actions. */
export function FolderSection({ tree, current, dropOver, showFolders, onOpen }: Props) {
  const actions = useFolderActions();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const path = pathTo(tree, current);
  const subfolders = childrenOf(tree, current);
  const close = () => setDialog(null);

  const menu = (f: Folder): MenuItem[] => [
    { label: s.open, icon: <FolderOpen />, onSelect: () => onOpen(f.id) },
    { label: s.rename, icon: <Pencil />, onSelect: () => setDialog({ kind: "rename", folder: f }) },
    {
      label: s.move,
      icon: <FolderInput />,
      onSelect: () => setDialog({ kind: "move", folder: f }),
    },
    {
      label: s.delete,
      icon: <Trash2 />,
      danger: true,
      onSelect: () => setDialog({ kind: "delete", folder: f }),
    },
  ];

  const parentName = (f: Folder) =>
    f.parentId ? (tree.byId.get(f.parentId)?.name ?? s.topLevel) : s.topLevel;

  return (
    <div className="flex flex-col gap-3">
      <FolderBreadcrumb
        path={path}
        dropOver={dropOver}
        onOpen={onOpen}
        onNewFolder={() => setDialog({ kind: "new" })}
      />
      {showFolders && subfolders.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          <AnimatePresence initial={false}>
            {subfolders.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                deepCount={countDeep(tree, f.id)}
                subfolders={childrenOf(tree, f.id).length}
                menu={menu(f)}
                dropActive={dropOver === f.id}
                onOpen={() => onOpen(f.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <FolderNameDialog
        open={dialog?.kind === "new"}
        title={current ? s.newFolderIn(path[path.length - 1]?.name ?? "") : s.newFolder}
        confirmLabel={s.create}
        onClose={close}
        onSubmit={(name) => void actions.create(name, current)}
      />
      <FolderNameDialog
        key={dialog?.kind === "rename" ? dialog.folder.id : "rename"}
        open={dialog?.kind === "rename"}
        title={s.rename}
        initial={dialog?.kind === "rename" ? dialog.folder.name : ""}
        confirmLabel={strings.common.save}
        onClose={close}
        onSubmit={(name) =>
          dialog?.kind === "rename" && void actions.rename(dialog.folder.id, name)
        }
      />
      <FolderPicker
        open={dialog?.kind === "move"}
        title={s.move}
        tree={tree}
        isAllowed={(t) => dialog?.kind === "move" && canMoveFolder(tree, dialog.folder.id, t)}
        onClose={close}
        onPick={(target) =>
          dialog?.kind === "move" && void actions.moveFolder(dialog.folder.id, target)
        }
      />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title={dialog?.kind === "delete" ? s.deleteTitle(dialog.folder.name) : ""}
        body={dialog?.kind === "delete" ? s.deleteBody(parentName(dialog.folder)) : ""}
        confirmLabel={s.delete}
        onConfirm={() => {
          if (dialog?.kind === "delete") {
            const f = dialog.folder;
            // Deleting the folder you're in takes you to where its content went.
            if (path.some((p) => p.id === f.id)) onOpen(f.parentId);
            void actions.remove(f.id);
          }
          close();
        }}
        onCancel={close}
      />
    </div>
  );
}
