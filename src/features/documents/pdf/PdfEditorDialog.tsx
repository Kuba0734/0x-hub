import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { GlassButton, GlassDialog } from "@/components/glass";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ipc, toIpcError, type DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { docKeys, useDocumentContent } from "../queries";
import { EditorPageView } from "./EditorPageView";
import { PageStrip } from "./PageStrip";
import * as edit from "./pdfEdit";
import { EditorTray, type TrayPick } from "./EditorTray";
import { usePageSize } from "./usePageAspect";
import { usePdfDocument } from "./usePdfDocument";

const s = strings.pdfTools;

interface Props {
  doc: DocumentItem;
  open: boolean;
  /** "sign" only changes the title and hint; both modes can do everything. */
  mode: "pages" | "sign";
  onClose: () => void;
}

/**
 * Rotate, remove, reorder pages and add text, dates, marks, white boxes and signatures;
 * saves in place or as a copy.
 */
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
  const { aspect, heightPt } = usePageSize(pdf, (current?.source ?? 0) + 1, current?.rotate ?? 0);
  const kept = state.pages.filter((p) => !p.removed).length;
  const dirty = edit.isDirty(state);

  const close = () => (dirty && !busy ? setConfirmClose(true) : finish());

  const place = (pick: TrayPick) => {
    if (!current || current.removed) return;
    const base = { key: crypto.randomUUID(), pageKey: current.key };
    const n = state.items.filter((i) => i.pageKey === current.key).length;
    const item: edit.PlacedItem =
      pick.kind === "signature"
        ? {
            ...base,
            kind: "signature",
            signatureId: pick.signature.id,
            rect: edit.newStampRect(pick.signature.width, pick.signature.height, aspect),
          }
        : pick.kind === "text"
          ? {
              ...base,
              kind: "text",
              text: pick.text,
              fontSize: edit.DEFAULT_FONT_PT / heightPt,
              rect: edit.newMarkRect("text", aspect, n),
            }
          : { ...base, kind: pick.kind, rect: edit.newMarkRect(pick.kind, aspect, n) };
    setState((st) => edit.addItem(st, item));
  };

  const save = async (asCopy: boolean) => {
    setBusy(true);
    try {
      const req = edit.toRequest(state);
      const id = await ipc.documents.editPdf(
        doc.id,
        req.pages,
        req.items,
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
    const items = state.items.filter((i) => i.pageKey === current.key);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex h-[calc(85vh-340px)] min-h-[200px] gap-4">
          <EditorPageView
            pdf={pdf}
            page={current}
            items={items}
            aspect={aspect}
            heightPt={heightPt}
            onPatch={(key, patch) => setState((st) => edit.updateItem(st, key, patch))}
            onRemove={(key) => setState((st) => edit.removeItem(st, key))}
          />
          <EditorTray onPick={place} disabled={current.removed} />
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
                : `${s.pagesLeft(kept, state.pages.length)} · ${s.placed(state.items.length)} · ${s.overwriteHint}`}
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
