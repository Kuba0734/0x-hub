import { useNavigate } from "react-router";
import {
  ArchiveRestore,
  CheckSquare,
  Lock,
  NotebookPen,
  PanelLeft,
  RefreshCw,
  StickyNote,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import { navItems, playgroundItem } from "@/app/nav";
import { ipc, toIpcError } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { useUi } from "@/stores/ui";
import { useUpdates } from "@/stores/updates";
import { useNewNote } from "@/features/notes/useNewNote";

export interface PaletteAction {
  id: string;
  label: string;
  icon: ReactNode;
  group: "navigate" | "actions";
  keywords?: string;
  run: () => void;
}

export function usePaletteActions(): PaletteAction[] {
  const navigate = useNavigate();
  const newNote = useNewNote();
  const ui = useUi.getState;
  const a = strings.palette.actions;

  const nav = (import.meta.env.DEV ? [...navItems, playgroundItem] : navItems).map<PaletteAction>(
    (n) => ({
      id: `nav-${n.path}`,
      label: n.label,
      icon: <n.icon />,
      group: "navigate",
      run: () => navigate(n.path),
    }),
  );

  const actions: PaletteAction[] = [
    {
      id: "new-note",
      label: a.newNote,
      icon: <NotebookPen />,
      group: "actions",
      keywords: "create markdown",
      run: () => newNote("markdown"),
    },
    {
      id: "new-checklist",
      label: a.newChecklist,
      icon: <CheckSquare />,
      group: "actions",
      keywords: "todo tasks",
      run: () => newNote("checklist"),
    },
    {
      id: "new-sticky",
      label: a.newSticky,
      icon: <StickyNote />,
      group: "actions",
      keywords: "quick",
      run: () => newNote("sticky"),
    },
    {
      id: "upload",
      label: a.upload,
      icon: <Upload />,
      group: "actions",
      keywords: "import file add",
      run: () => {
        ui().requestUpload();
        navigate("/documents");
      },
    },
    {
      id: "lock",
      label: a.lock,
      icon: <Lock />,
      group: "actions",
      run: () => void ipc.vault.lock(),
    },
    {
      id: "backup",
      label: a.backup,
      icon: <ArchiveRestore />,
      group: "actions",
      keywords: "export",
      run: () => {
        void ipc.backup.runAuto().then(
          (path) => (path ? toast.show(strings.settings.backupDone) : navigate("/settings/backup")),
          (e) => toast.error(toIpcError(e).message),
        );
      },
    },
    {
      id: "updates",
      label: a.checkUpdates,
      icon: <RefreshCw />,
      group: "actions",
      run: () => void useUpdates.getState().check(true),
    },
    {
      id: "sidebar",
      label: a.toggleSidebar,
      icon: <PanelLeft />,
      group: "actions",
      run: () => ui().setSidebarCollapsed(!ui().sidebarCollapsed),
    },
  ];

  return [...nav, ...actions];
}
