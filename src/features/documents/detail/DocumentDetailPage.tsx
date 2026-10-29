import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Download, ExternalLink, Pin, PinOff, Trash2 } from "lucide-react";
import { GlassButton, GlassPanel, GlassTooltip } from "@/components/glass";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { useCategories, useDocument, useDocumentLifecycle, useUpdateDocument } from "../queries";
import { exportDocument, openExternally } from "../useDocumentActions";
import { MetaPanel } from "./MetaPanel";
import { PreviewPane } from "./PreviewPane";

const s = strings.documents;

function TitleInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      aria-label={strings.common.rename}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => (draft.trim() && draft !== value ? onCommit(draft) : setDraft(value))}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="min-w-0 flex-1 rounded-lg bg-transparent px-1 text-[20px] font-semibold tracking-[-0.02em] text-fg hover:bg-white/[0.04] focus-visible:bg-white/[0.06]"
    />
  );
}

export function DocumentDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: doc, isLoading, error, refetch } = useDocument(id);
  const categories = useCategories();
  const update = useUpdateDocument();
  const { trash } = useDocumentLifecycle();

  if (isLoading)
    return (
      <div className="flex h-full gap-4 p-6">
        <Skeleton className="flex-1 rounded-3xl" />
        <Skeleton className="w-[360px] rounded-3xl" />
      </div>
    );
  if (error || !doc)
    return (
      <ErrorState
        message={error?.message ?? strings.errors.loadFailed}
        onRetry={() => void refetch()}
      />
    );

  const patch = (p: Parameters<typeof update.mutate>[0]["patch"]) =>
    update.mutate({ id: doc.id, patch: p });

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          icon={<ArrowLeft />}
          aria-label={strings.common.back}
          onClick={() => navigate("/documents")}
        />
        <TitleInput key={doc.title} value={doc.title} onCommit={(title) => patch({ title })} />
        <GlassTooltip label={doc.pinned ? strings.common.unpin : strings.common.pin}>
          <GlassButton
            size="sm"
            iconOnly
            aria-label={doc.pinned ? strings.common.unpin : strings.common.pin}
            aria-pressed={doc.pinned}
            icon={doc.pinned ? <PinOff /> : <Pin />}
            onClick={() => patch({ pinned: !doc.pinned })}
          />
        </GlassTooltip>
        <GlassButton size="sm" icon={<Download />} onClick={() => void exportDocument(doc)}>
          {s.export}
        </GlassButton>
        <GlassTooltip label={s.openExternallyHint}>
          <GlassButton size="sm" icon={<ExternalLink />} onClick={() => void openExternally(doc)}>
            {s.openExternally}
          </GlassButton>
        </GlassTooltip>
        <GlassButton
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={strings.common.moveToTrash}
          icon={<Trash2 />}
          onClick={() =>
            trash.mutate(doc.id, {
              onSuccess: () => {
                toast.show(s.trashed);
                navigate("/documents");
              },
            })
          }
        />
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <GlassPanel refract={false} className="min-w-0 flex-1 overflow-hidden">
          <PreviewPane doc={doc} />
        </GlassPanel>
        <GlassPanel refract={false} className="w-[360px] shrink-0 overflow-y-auto p-5">
          <MetaPanel key={doc.id} doc={doc} categories={categories.data ?? []} onPatch={patch} />
        </GlassPanel>
      </div>
    </div>
  );
}
