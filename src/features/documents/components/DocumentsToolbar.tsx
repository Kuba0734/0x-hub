import { LayoutGrid, List, Search, Settings2, Tag, Upload } from "lucide-react";
import { GlassButton, GlassInput, GlassSelect, GlassTooltip } from "@/components/glass";
import { cn } from "@/lib/format";
import type { Category } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import type { DocFilters, ExpiryFilter, SortKey } from "../filters";

interface Props {
  filters: DocFilters;
  onChange: (f: DocFilters) => void;
  categories: Category[];
  tags: string[];
  view: "grid" | "list";
  onView: (v: "grid" | "list") => void;
  onUpload: () => void;
  onManageCategories: () => void;
}

const s = strings.documents;

export function DocumentsToolbar({
  filters,
  onChange,
  categories,
  tags,
  view,
  onView,
  onUpload,
  onManageCategories,
}: Props) {
  const set = (patch: Partial<DocFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <GlassInput
          label={s.filterPlaceholder}
          hideLabel
          placeholder={s.filterPlaceholder}
          leading={<Search />}
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
          wrapperClassName="w-64"
          className="h-9 rounded-full"
        />
        <GlassSelect<ExpiryFilter>
          label={s.expiry}
          value={filters.expiry}
          onChange={(expiry) => set({ expiry })}
          options={(["all", "soon", "expired", "none"] as const).map((v) => ({
            value: v,
            label: s.expiryFilter[v],
          }))}
        />
        {tags.length > 0 && (
          <GlassSelect<string>
            label={s.tags}
            value={filters.tag ?? ""}
            onChange={(tag) => set({ tag: tag || null })}
            options={[
              { value: "", label: s.tags },
              ...tags.map((t) => ({ value: t, label: `#${t}` })),
            ]}
          />
        )}
        <GlassSelect<SortKey>
          label={strings.common.sort}
          value={filters.sort}
          onChange={(sort) => set({ sort })}
          options={(["updated", "title", "expiry", "size"] as const).map((v) => ({
            value: v,
            label: s.sortBy[v],
          }))}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <div
            className="flex rounded-full border border-line p-0.5"
            role="radiogroup"
            aria-label={strings.common.filter}
          >
            {(["grid", "list"] as const).map((v) => (
              <GlassTooltip key={v} label={v === "grid" ? s.gridView : s.listView}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  aria-label={v === "grid" ? s.gridView : s.listView}
                  onClick={() => onView(v)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                    view === v ? "bg-white/[0.12] text-fg" : "text-fg-3 hover:text-fg",
                  )}
                >
                  {v === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </button>
              </GlassTooltip>
            ))}
          </div>
          <GlassButton variant="primary" icon={<Upload />} onClick={onUpload}>
            {s.upload}
          </GlassButton>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5"
        role="radiogroup"
        aria-label={s.category}
      >
        {[
          { id: "all", name: s.allCategories },
          ...categories,
          { id: "none", name: s.uncategorized },
        ].map((c) => {
          const active = filters.categoryId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set({ categoryId: c.id })}
              className={cn(
                "h-7 rounded-full px-3 text-[12px] transition-colors duration-150",
                active
                  ? "bg-white font-medium text-black"
                  : "border border-line text-fg-2 hover:bg-white/[0.06] hover:text-fg",
              )}
            >
              {c.name}
              {"documentCount" in c && c.documentCount > 0 && (
                <span className={active ? "ml-1.5 opacity-60" : "ml-1.5 text-fg-3"}>
                  {c.documentCount}
                </span>
              )}
            </button>
          );
        })}
        <GlassTooltip label={s.manageCategories}>
          <button
            type="button"
            aria-label={s.manageCategories}
            onClick={onManageCategories}
            className="flex h-7 w-7 items-center justify-center rounded-full text-fg-3 hover:bg-white/[0.06] hover:text-fg"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </GlassTooltip>
        {filters.tag && (
          <button
            type="button"
            onClick={() => set({ tag: null })}
            className="ml-2 flex h-7 items-center gap-1 rounded-full border border-white/30 px-2.5 text-[12px]"
          >
            <Tag className="h-3 w-3" />#{filters.tag} ×
          </button>
        )}
      </div>
    </div>
  );
}
