import { LayoutGrid, List, Search, Smartphone, Tag, Upload } from "lucide-react";
import { GlassButton, GlassInput, GlassSelect, GlassTooltip } from "@/components/glass";
import { cn } from "@/lib/format";
import { strings } from "@/lib/strings";
import type { DocFilters, ExpiryFilter, SortKey } from "../filters";

interface Props {
  filters: DocFilters;
  onChange: (f: DocFilters) => void;
  tags: string[];
  view: "grid" | "list";
  onView: (v: "grid" | "list") => void;
  onUpload: () => void;
  onPhone: () => void;
}

const s = strings.documents;

export function DocumentsToolbar({
  filters,
  onChange,
  tags,
  view,
  onView,
  onUpload,
  onPhone,
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
          <GlassButton icon={<Smartphone />} onClick={onPhone}>
            {s.fromPhone}
          </GlassButton>
          <GlassButton variant="primary" icon={<Upload />} onClick={onUpload}>
            {s.upload}
          </GlassButton>
        </div>
      </div>

      {filters.tag && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => set({ tag: null })}
            className="flex h-7 items-center gap-1 rounded-full border border-white/30 px-2.5 text-[12px]"
          >
            <Tag className="h-3 w-3" />#{filters.tag} ×
          </button>
        </div>
      )}
    </div>
  );
}
