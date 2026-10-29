import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileUp, SearchX, Upload } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { strings } from "@/lib/strings";
import { useUi } from "@/stores/ui";
import { CategoriesDialog } from "./components/CategoriesDialog";
import { DocumentCollection } from "./components/DocumentCollection";
import { DocumentsToolbar } from "./components/DocumentsToolbar";
import { DropOverlay, FlyingChips } from "./components/DropZone";
import { TrashList } from "./components/TrashList";
import { allTags, applyFilters, defaultFilters, type DocFilters } from "./filters";
import { useCategories, useDocuments } from "./queries";
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
  const [manage, setManage] = useState(false);
  const [phone, setPhone] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const docs = useDocuments(false);
  const categories = useCategories();
  const menuFor = useDocumentActions();
  const importCategory =
    filters.categoryId !== "all" && filters.categoryId !== "none" ? filters.categoryId : null;
  const getTarget = useCallback(() => {
    const r = gridRef.current?.getBoundingClientRect();
    return r ? { x: r.left + 24, y: r.top + 24 } : { x: 300, y: 200 };
  }, []);
  const imp = useDocumentImport(importCategory, getTarget);

  const catById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );
  const tags = useMemo(() => allTags(docs.data ?? []), [docs.data]);
  const visible = useMemo(() => applyFilters(docs.data ?? [], filters), [docs.data, filters]);

  useEffect(() => localStorage.setItem(VIEW_KEY, view), [view]);

  const selection = useSelection();
  const order = useMemo(() => visible.map((d) => d.id), [visible]);
  const selectedDocs = visible.filter((d) => selection.selected.has(d.id));
  const { selectAll, clear } = selection;

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
    if (!docs.data?.length)
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
    if (!visible.length) return <EmptyState icon={<SearchX />} title={s.noMatches} />;
    return (
      <DocumentCollection
        docs={visible}
        view={view}
        categories={catById}
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
              categories={categories.data ?? []}
              tags={tags}
              view={view}
              onView={setView}
              onUpload={() => void imp.pick()}
              onPhone={() => setPhone(true)}
              onManageCategories={() => setManage(true)}
            />
            <div className="mt-5">{content}</div>
          </>
        )}
      </div>
      {tab === "active" && (
        <SelectionBar
          docs={selectedDocs}
          categories={categories.data ?? []}
          onSelectAll={() => selectAll(order)}
          onClear={clear}
        />
      )}
      <DropOverlay drag={imp.drag} />
      <FlyingChips flying={imp.flying} onDone={imp.clearFlying} />
      <PhoneUploadDialog open={phone} onClose={() => setPhone(false)} />
      <CategoriesDialog
        open={manage}
        onClose={() => setManage(false)}
        categories={categories.data ?? []}
      />
    </div>
  );
}
