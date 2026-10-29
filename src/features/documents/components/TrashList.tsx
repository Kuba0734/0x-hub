import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatBytes, relativeTime } from "@/lib/format";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { useDocumentLifecycle, useDocuments } from "../queries";
import { KindIcon } from "./Thumbnail";

export function TrashList() {
  const { data, isLoading, error, refetch } = useDocuments(true);
  const { restore, remove } = useDocumentLifecycle();
  const [confirm, setConfirm] = useState<string | null>(null);
  const s = strings.documents;

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (error) return <ErrorState message={error.message} onRetry={() => void refetch()} />;
  if (!data?.length)
    return <EmptyState icon={<Trash2 />} title={s.trashEmpty} body={strings.common.trashHint} />;

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 text-[12px] text-fg-3">{strings.common.trashHint}</p>
      {data.map((d) => (
        <div
          key={d.id}
          className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.04]"
        >
          <KindIcon kind={d.kind} className="h-5 w-5 text-fg-3" />
          <span className="min-w-0 flex-1 truncate text-[14px]">{d.title}</span>
          <span className="text-[12px] text-fg-3">{formatBytes(d.size)}</span>
          <span className="w-28 text-[12px] text-fg-3">
            {d.deletedAt ? relativeTime(d.deletedAt) : ""}
          </span>
          <GlassButton
            size="sm"
            variant="ghost"
            icon={<RotateCcw />}
            onClick={() => restore.mutate(d.id, { onSuccess: () => toast.show(s.restored) })}
          >
            {strings.common.restore}
          </GlassButton>
          <GlassButton size="sm" variant="ghost" icon={<Trash2 />} onClick={() => setConfirm(d.id)}>
            {strings.common.deleteForever}
          </GlassButton>
        </div>
      ))}
      <ConfirmDialog
        open={confirm !== null}
        title={s.confirmDeleteTitle}
        body={s.confirmDeleteBody}
        confirmLabel={strings.common.deleteForever}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) remove.mutate(confirm, { onSuccess: () => toast.show(s.deleted) });
          setConfirm(null);
        }}
      />
    </div>
  );
}
