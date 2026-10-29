import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RotateCcw, ScanText } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ipc, onEvent, toIpcError, type DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { docKeys, useOcrText } from "../queries";

const s = strings.documents;

export function OcrSection({ doc }: { doc: DocumentItem }) {
  const qc = useQueryClient();
  const [page, setPage] = useState<{ done: number; total: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { data: text } = useOcrText(doc.id, doc.ocrStatus === "done");

  useEffect(
    () =>
      onEvent("progress://ocr", (p) => {
        if (p.documentId !== doc.id) return;
        if (p.status === "running") setPage({ done: p.done, total: p.total });
        else {
          setPage(null);
          void qc.invalidateQueries({ queryKey: docKeys.one(doc.id) });
          void qc.invalidateQueries({ queryKey: docKeys.ocr(doc.id) });
        }
      }),
    [doc.id, qc],
  );

  if (doc.kind !== "image" && doc.kind !== "pdf") return null;

  const rerun = async () => {
    try {
      await ipc.documents.rerunOcr(doc.id);
      await qc.invalidateQueries({ queryKey: docKeys.one(doc.id) });
    } catch (e) {
      toast.error(toIpcError(e).message);
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[13px] font-medium tracking-normal text-fg-2">
          <ScanText className="h-4 w-4" />
          {s.ocr}
        </h3>
        {(doc.ocrStatus === "done" || doc.ocrStatus === "failed") && (
          <GlassButton variant="ghost" size="sm" icon={<RotateCcw />} onClick={rerun}>
            {s.ocrRerun}
          </GlassButton>
        )}
      </div>
      <p
        className={`text-[12px] ${doc.ocrStatus === "failed" ? "font-medium text-fg" : "text-fg-3"}`}
      >
        {s.ocrStatus[doc.ocrStatus]}
      </p>
      {page && (
        <div className="flex items-center gap-2">
          <ProgressBar value={page.done / page.total} label={s.ocr} className="flex-1" />
          <span className="tabular text-[11px] text-fg-3">{s.ocrPage(page.done, page.total)}</span>
        </div>
      )}
      {doc.ocrStatus === "done" && (
        <div className="relative">
          <p
            className={`text-[12.5px] leading-relaxed whitespace-pre-wrap text-fg-2 select-text ${expanded ? "" : "line-clamp-6"}`}
          >
            {text || s.ocrEmpty}
          </p>
          {text && text.length > 300 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-[12px] text-fg-3 hover:text-fg"
            >
              {expanded ? strings.common.showLess : strings.common.showMore}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
