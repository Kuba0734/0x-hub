import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { GlassButton, GlassDialog } from "@/components/glass";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ipc, toIpcError, type DocumentItem, type Signature } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useElementSize } from "@/lib/useElementSize";
import { toast } from "@/stores/toasts";
import { docKeys, useDocumentContent } from "../queries";
import { PageCanvas } from "./PageCanvas";
import { PageStrip } from "./PageStrip";
import * as edit from "./pdfEdit";
import { SignatureTray } from "./SignatureTray";
import { StampLayer } from "./StampLayer";
import { usePageAspect } from "./usePageAspect";
import { usePdfDocument } from "./usePdfDocument";

const s = strings.pdfTools;

interface Props {
  doc: DocumentItem;
  open: boolean;
  /** "sign" only changes the title and hint; both modes can do everything. */
  mode: "pages" | "sign";
  onClose: () => void;
}

/** Rotate, remove, reorder pages and place signatures; saves in place or as a copy. */
export function PdfEditorDialog({ doc, open, mode, onClose }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const content = useDocumentContent(doc.id, open);
  const { pdf, failed } = usePdfDocument(open ? content.data : undefined);
  /** Edits so far; null until the first change (then the untouched PDF is the state). */
  const [edited, setEdited] = useState<edit.EditState | null>(null);
  const [selected, setSelected] = useState("p0");
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [viewRef, view] = useElementSize<HTMLDivElement>();

  const pageCount = pdf?.numPages ?? 0;
  const state = edited ?? edit.initialState(pageCount);
  const setState = (fn: (st: edit.EditState) => edit.EditState) =>
    setEdited((prev) => fn(prev ?? edit.initialState(pageCount)));
  const finish = () => {
    setEdited(null);
    setSelected("p0");
    onClose();
  };

  const current = state.pages.find((p) => p.key === selected) ?? state.pages[0];
  const aspect = usePageAspect(pdf, (current?.source ?? 0) + 1, current?.rotate ?? 0);
  const pageWidth = Math.floor(Math.max(120, Math.min(view.width, view.height * aspect)));
  const kept = state.pages.filter((p) => !p.removed).length;
  const dirty = edit.isDirty(state);

  const close = () => (dirty && !busy ? setConfirmClose(true) : finish());

  const place = (sig: Signature) => {
    if (!current || current.removed) return;
    const stamp: edit.PlacedStamp = {
      key: crypto.randomUUID(),
      pageKey: current.key,
      signatureId: sig.id,
      rect: edit.newStampRect(sig.width, sig.height, aspect),
    };
    setState((st) => ({ ...st, stamps: [...st.stamps, stamp] }));
  };

  const save = async (asCopy: boolean) => {
    setBusy(true);
    try {
      const req = edit.toRequest(state);
      const id = await ipc.documents.editPdf(
        doc.id,
        req.pages,
        req.stamps,
        asCopy ? s.copyTitle(doc.title) : undefined,
      );
      await qc.invalidateQueries({ queryKey: docKeys.all });
      void qc.invalidateQueries({ queryKey: ["overview"] });
      toast.show(asCopy ? s.savedCopy : s.saved);
      finish();
      if (asCopy) navigate(`/documents/${id}`);
    } catch (e) {
      toast.error(toIpcError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const body = (() => {
    if (content.error || failed)
      return <ErrorState message={content.error?.message} onRetry={() => void content.refetch()} />;
    if (!pdf || !current) return <Skeleton className="h-[calc(85vh-200px)] rounded-2xl" />;
    const stamps = state.stamps.filter((st) => st.pageKey === current.key);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex h-[calc(85vh-340px)] min-h-[200px] gap-4">
          <div ref={viewRef} className="flex min-w-0 flex-1 items-center justify-center">
            <div className="relative" style={{ width: pageWidth }}>
              <PageCanvas
                pdf={pdf}
                page={current.source + 1}
                rotation={current.rotate}
                width={pageWidth}
                className="rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
              />
              {!current.removed && (
                <StampLayer
                  stamps={stamps}
                  onChange={(key, rect) =>
                    setState((st) => ({
                      ...st,
                      stamps: st.stamps.map((x) => (x.key === key ? { ...x, rect } : x)),
                    }))
                  }
                  onRemove={(key) =>
                    setState((st) => ({ ...st, stamps: st.stamps.filter((x) => x.key !== key) }))
                  }
                />
              )}
            </div>
          </div>
          <SignatureTray onPick={place} />
        </div>
        <PageStrip
          pdf={pdf}
          pages={state.pages}
          selected={current.key}
          onSelect={setSelected}
          onReorder={(keys) => setState((st) => edit.reorder(st, keys))}
          onRotate={(key, d) => setState((st) => edit.rotate(st, key, d))}
          onToggleRemoved={(key) => setState((st) => edit.toggleRemoved(st, key))}
        />
      </div>
    );
  })();

  return (
    <>
      <GlassDialog
        open={open}
        onClose={close}
        dismissible={!busy}
        title={mode === "sign" ? s.signTitle : s.title}
        description={mode === "sign" ? s.signHint : s.pagesHint}
        width={1180}
        footer={
          <>
            <p className="mr-auto self-center text-[12px] text-fg-3">
              {kept === 0
                ? s.noPagesLeft
                : `${s.pagesLeft(kept, state.pages.length)} · ${s.placed(state.stamps.length)} · ${s.overwriteHint}`}
            </p>
            <GlassButton onClick={() => void save(true)} disabled={!dirty || busy || kept === 0}>
              {s.saveCopy}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={() => void save(false)}
              disabled={!dirty || busy || kept === 0}
            >
              {busy ? s.saving : s.save}
            </GlassButton>
          </>
        }
      >
        {open && body}
      </GlassDialog>
      <ConfirmDialog
        open={confirmClose}
        title={s.discardTitle}
        body={s.discardBody}
        confirmLabel={s.discard}
        onConfirm={() => {
          setConfirmClose(false);
          finish();
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  );
}
