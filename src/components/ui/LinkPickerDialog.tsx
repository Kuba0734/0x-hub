import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { GlassDialog, GlassInput } from "@/components/glass";
import { strings } from "@/lib/strings";

export interface PickItem {
  id: string;
  title: string;
  subtitle?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  items: PickItem[];
  onPick: (id: string) => void;
}

/** Searchable list for linking notes and documents. */
export function LinkPickerDialog({ open, onClose, title, items, onPick }: Props) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? items.filter((i) => i.title.toLowerCase().includes(t)) : items).slice(0, 50);
  }, [items, q]);

  return (
    <GlassDialog open={open} onClose={onClose} title={title} width={480}>
      <GlassInput
        label={strings.common.search}
        hideLabel
        placeholder={strings.common.search}
        leading={<Search />}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        data-autofocus
      />
      <ul className="mt-3 flex max-h-80 flex-col gap-0.5 overflow-y-auto">
        {shown.length === 0 && (
          <li className="px-3 py-6 text-center text-[13px] text-fg-3">{strings.palette.empty}</li>
        )}
        {shown.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => {
                onPick(i.id);
                onClose();
              }}
              className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-white/[0.06]"
            >
              <span className="truncate text-[14px]">{i.title || strings.common.untitled}</span>
              {i.subtitle && <span className="truncate text-[12px] text-fg-3">{i.subtitle}</span>}
            </button>
          </li>
        ))}
      </ul>
    </GlassDialog>
  );
}
