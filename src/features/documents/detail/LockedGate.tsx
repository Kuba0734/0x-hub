import { useQueryClient } from "@tanstack/react-query";
import { RevealGate } from "@/components/ui/RevealGate";
import { ipc, type DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { docKeys } from "../queries";

/** Shown instead of preview and details until the user re-confirms identity. */
export function LockedGate({ doc }: { doc: DocumentItem }) {
  const qc = useQueryClient();
  return (
    <RevealGate
      title={strings.documents.lockedTitle}
      onReveal={async (password) => {
        await ipc.documents.reveal(doc.id, password);
        await qc.invalidateQueries({ queryKey: docKeys.all });
      }}
    />
  );
}
