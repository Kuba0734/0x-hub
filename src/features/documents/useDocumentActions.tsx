import { useNavigate } from "react-router";
import {
  Download,
  ExternalLink,
  FolderInput,
  FolderOpen,
  Lock,
  LockOpen,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import type { MenuItem } from "@/components/glass";
import { ipc, toIpcError, type DocumentItem } from "@/lib/ipc";
import { dialogs } from "@/lib/platform";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { useDocumentLifecycle, useUpdateDocument } from "./queries";

export async function exportDocument(doc: DocumentItem) {
  try {
    const target = await dialogs.saveFile(doc.filename);
    if (!target) return;
    await ipc.documents.export(doc.id, target);
    toast.show(strings.documents.exportDone);
  } catch (e) {
    toast.error(toIpcError(e).message);
  }
}

export async function openExternally(doc: DocumentItem) {
  try {
    await ipc.documents.openExternal(doc.id);
  } catch (e) {
    toast.error(toIpcError(e).message);
  }
}

/** Shared context-menu actions for a document. `onMove` opens the folder picker. */
export function useDocumentActions(onMove: (doc: DocumentItem) => void) {
  const navigate = useNavigate();
  const update = useUpdateDocument();
  const { trash } = useDocumentLifecycle();

  // Locked documents only offer "Open" (which asks for confirmation) — no export or lock removal.
  const lockItems = (doc: DocumentItem): MenuItem[] => {
    if (doc.locked && !doc.revealed) return [];
    const lockToggle: MenuItem = {
      label: doc.locked ? strings.documents.unlockDocument : strings.documents.lockDocument,
      icon: doc.locked ? <LockOpen /> : <Lock />,
      onSelect: () =>
        update.mutate(
          { id: doc.id, patch: { locked: !doc.locked } },
          {
            onSuccess: () =>
              toast.show(
                doc.locked ? strings.documents.unlockedDone : strings.documents.lockedDone,
              ),
          },
        ),
    };
    return [
      {
        label: strings.documents.export,
        icon: <Download />,
        onSelect: () => void exportDocument(doc),
      },
      {
        label: strings.documents.openExternally,
        icon: <ExternalLink />,
        onSelect: () => void openExternally(doc),
      },
      lockToggle,
    ];
  };

  return (doc: DocumentItem): MenuItem[] => [
    {
      label: strings.common.open,
      icon: <FolderOpen />,
      onSelect: () => navigate(`/documents/${doc.id}`),
    },
    {
      label: doc.pinned ? strings.common.unpin : strings.common.pin,
      icon: doc.pinned ? <PinOff /> : <Pin />,
      onSelect: () => update.mutate({ id: doc.id, patch: { pinned: !doc.pinned } }),
    },
    {
      label: strings.documents.moveTo,
      icon: <FolderInput />,
      onSelect: () => onMove(doc),
    },
    ...lockItems(doc),
    {
      label: strings.common.moveToTrash,
      icon: <Trash2 />,
      danger: true,
      onSelect: () =>
        trash.mutate(doc.id, { onSuccess: () => toast.show(strings.documents.trashed) }),
    },
  ];
}
