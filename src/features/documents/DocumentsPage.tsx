import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileUp, FolderOpen, SearchX, Upload } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import type { DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useUi } from "@/stores/ui";
import { DocumentCollection } from "./components/DocumentCollection";
import { DocumentsToolbar } from "./components/DocumentsToolbar";
import { DropOverlay, FlyingChips } from "./components/DropZone";
import { TrashList } from "./components/TrashList";
import { allTags, applyFilters, defaultFilters, isSearching, type DocFilters } from "./filters";
import { DragGhost } from "./folders/DragGhost";
import { FolderPicker } from "./folders/FolderPicker";
import { FolderSection } from "./folders/FolderSection";
import { childrenOf, docsIn, pathLabel } from "./folders/folderTree";
import { useCurrentFolder } from "./folders/useCurrentFolder";
import { useDocumentDrag } from "./folders/useDocumentDrag";
import { useFolderActions } from "./folders/useFolderActions";
import { useDocuments } from "./queries";
import { useDocumentActions } from "./useDocumentActions";
import { useDocumentImport } from "./useDocumentImport";
import { PhoneUploadDialog } from "./phone/PhoneUploadDialog";
import { SelectionBar } from "./selection/SelectionBar";
import { useSelection } from "./selection/useSelection";

const VIEW_KEY = "0xhub.documents.view";
const s = strings.documents;

export function DocumentsPage() {
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [filters, setFilters] = useState<DocFilters>(defaultFilters);
  const [view, setView] = useState<"grid" | "list">(() =>
    localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid",
  );
  const [phone, setPhone] = useState(false);
  const [moveDoc, setMoveDoc] = useState<DocumentItem | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const docs = useDocuments(false);
  const { tree, current, open } = useCurrentFolder();
  const folderActions = useFolderActions();
  const menuFor = useDocumentActions(setMoveDoc);
  const getTarget = useCallback(() => {
    const r = gridRef.current?.getBoundingClientRect();
    return r ? { x: r.left + 24, y: r.top + 24 } : { x: 300, y: 200 };
  }, []);
  // New files land in the folder you're looking at.
  const imp = useDocumentImport(current, getTarget);

  const searching = isSearching(filters);
  const tags = useMemo(() => allTags(docs.data ?? []), [docs.data]);
  const visible = useMemo(() => {
    const filtered = applyFilters(docs.data ?? [], filters);
    return searching ? filtered : docsIn(filtered, current);
  }, [docs.data, filters, searching, current]);
  const folderName = (id: string) => (id ? (tree.byId.get(id)?.name ?? "") : s.folders.root);

  useEffect(() => localStorage.setItem(VIEW_KEY, view), [view]);

  const selection = useSelection();
  const order = useMemo(() => visible.map((d) => d.id), [visible]);
  const selectedDocs = visible.filter((d) => selection.selected.has(d.id));
  const { selectAll, clear } = selection;

  const drag = useDocumentDrag((moved, target) => {
    void folderActions.moveDocs(moved, target || null, folderName(target)).then(clear);
  });

  // Ctrl+A selects everything visible, Escape clears (not while typing in a field).
  useEffect(() => {
    if (tab !== "active") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable=true], [role=dialog], [role=menu]")) return;
      if (e.ctrlKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll(order);
      } else if (e.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, order, selectAll, clear]);

  // Switching folders starts a fresh selection.
  useEffect(() => clear(), [current, clear]);

  // "Upload document" from the palette or overview.
  const pendingUpload = useUi((st) => st.pendingUpload);
  const consumeUpload = useUi((st) => st.consumeUpload);
  const { pick } = imp;
  useEffect(() => {
    if (pendingUpload && consumeUpload()) void pick();
  }, [pendingUpload, consumeUpload, pick]);

  const content = (() => {
    if (docs.isLoading) return <SkeletonGrid />;
    if (docs.error)
      return <ErrorState message={docs.error.message} onRetry={() => void docs.refetch()} />;
    if (!docs.data?.length && tree.byId.size === 0)
      return (
        <EmptyState
          icon={<FileUp />}
          title={s.emptyTitle}
          body={s.emptyBody}
          action={
            <GlassButton variant="primary" icon={<Upload />} onClick={() => void imp.pick()}>
              {s.upload}
            </GlassButton>
          }
        />
      );
    if (!visible.length) {
      if (searching) return <EmptyState icon={<SearchX />} title={s.noMatches} />;
      if (childrenOf(tree, current).length) return null;
      return (
        <EmptyState
          icon={<FolderOpen />}
          title={s.folders.emptyFolder}
          body={s.folders.emptyFolderBody}
        />
      );
    }
    return (
      <DocumentCollection
        docs={visible}
        view={view}
        folderLabel={searching ? (d) => pathLabel(tree, d.folderId) || s.folders.root : undefined}
        onDragStart={(e, d) => drag.start(e, selection.selected.has(d.id) ? selectedDocs : [d])}
        menuFor={menuFor}
        fresh={imp.fresh}
        selected={selection.selected}
        onSelect={(id, mods) => selection.select(id, order, mods)}
      />
    );
  })();

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 pt-7 pb-10">
      <PageHeader
        title={s.title}
        tabsId="documents"
        tabs={[
          { value: "active", label: strings.common.all },
          { value: "trash", label: s.trashTitle },
        ]}
        tab={tab}
        onTab={setTab}
      />
      {imp.progress && (
        <div className="mt-4 flex items-center gap-3 text-[12px] text-fg-2" aria-live="polite">
          <span>{s.importing(imp.progress.done + 1, imp.progress.total)}</span>
          <ProgressBar
            value={imp.progress.done / imp.progress.total}
            label={s.upload}
            className="max-w-xs flex-1"
          />
        </div>
      )}
      <div className="mt-5" ref={gridRef}>
        {tab === "trash" ? (
          <TrashList />
        ) : (
          <>
            <DocumentsToolbar
              filters={filters}
              onChange={setFilters}
              tags={tags}
              view={view}
              onView={setView}
              onUpload={() => void imp.pick()}
              onPhone={() => setPhone(true)}
            />
            <div className="mt-4">
              <FolderSection
                tree={tree}
                current={current}
                dropOver={drag.state?.over}
                showFolders={!searching}
                onOpen={open}
              />
            </div>
            {searching && (
              <p className="mt-3 text-[12px] text-fg-3" aria-live="polite">
                {s.folders.searchAll}
              </p>
            )}
            <div className="mt-4">{content}</div>
          </>
        )}
      </div>
      {tab === "active" && (
        <SelectionBar
          docs={selectedDocs}
          tree={tree}
          onSelectAll={() => selectAll(order)}
          onClear={clear}
        />
      )}
      <FolderPicker
        open={moveDoc !== null}
        title={s.folders.moveDocs(1)}
        tree={tree}
        isAllowed={(t) => (moveDoc?.folderId ?? null) !== t}
        onClose={() => setMoveDoc(null)}
        onPick={(target, label) => moveDoc && void folderActions.moveDocs([moveDoc], target, label)}
      />
      <DragGhost
        drag={drag.state}
        targetName={drag.state?.over !== undefined ? folderName(drag.state.over) : undefined}
      />
      <DropOverlay drag={imp.drag} />
      <FlyingChips flying={imp.flying} onDone={imp.clearFlying} />
      <PhoneUploadDialog open={phone} onClose={() => setPhone(false)} />
    </div>
  );
}
