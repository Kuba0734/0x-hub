import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatBytes } from "@/lib/format";
import type { DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { KindIcon } from "../components/Thumbnail";
import { useDocumentContent, useImageSource } from "../queries";
import { openExternally } from "../useDocumentActions";
import { ImageViewer } from "./ImageViewer";
import { PdfViewer } from "./PdfViewer";

const s = strings.documents;
const TEXT_PREVIEW_BYTES = 256 * 1024;

function TextPreview({ data }: { data: ArrayBuffer }) {
  const text = useMemo(() => new TextDecoder().decode(data.slice(0, TEXT_PREVIEW_BYTES)), [data]);
  return (
    <pre className="h-full overflow-auto p-6 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-fg-2 select-text">
      {text}
    </pre>
  );
}

function NoPreview({ doc }: { doc: DocumentItem }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <KindIcon kind={doc.kind} className="h-14 w-14 text-fg-3" />
      <p className="text-[16px] font-medium">{doc.filename}</p>
      <p className="text-[12px] text-fg-3">
        {strings.documents.kinds[doc.kind]} · {formatBytes(doc.size)}
      </p>
      <p className="max-w-xs text-[13px] text-fg-2">
        {doc.kind === "office" ? s.officeHint : s.noPreview}
      </p>
      <GlassButton
        className="mt-2"
        icon={<ExternalLink />}
        onClick={() => void openExternally(doc)}
      >
        {s.openExternally}
      </GlassButton>
      <p className="max-w-xs text-[11px] text-fg-3">{s.openExternallyHint}</p>
    </div>
  );
}

const IMAGE_PREVIEW_MAX = 3200;

function ImagePreview({ doc }: { doc: DocumentItem }) {
  const { data, mime, isLoading, error, refetch } = useImageSource(doc, IMAGE_PREVIEW_MAX);
  if (isLoading) return <Skeleton className="m-6 h-[calc(100%-48px)]" />;
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => void refetch()} />;
  return <ImageViewer data={data} mime={mime} />;
}

export function PreviewPane({ doc }: { doc: DocumentItem }) {
  const previewable = doc.kind === "pdf" || doc.kind === "text";
  const { data, isLoading, error, refetch } = useDocumentContent(doc.id, previewable);

  if (doc.kind === "image") return <ImagePreview doc={doc} />;
  if (!previewable) return <NoPreview doc={doc} />;
  if (isLoading) return <Skeleton className="m-6 h-[calc(100%-48px)]" />;
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => void refetch()} />;
  if (doc.kind === "pdf") return <PdfViewer data={data} />;
  return <TextPreview data={data} />;
}
