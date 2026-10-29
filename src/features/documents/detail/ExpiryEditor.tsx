import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/format";
import { strings } from "@/lib/strings";
import { ExpiryBadge } from "../components/ExpiryBadge";

const PRESETS = [90, 30, 7, 1];
const s = strings.documents;

interface Props {
  expiresOn: string | null;
  offsets: number[];
  onDate: (iso: string) => void;
  onOffsets: (offsets: number[]) => void;
}

export function ExpiryEditor({ expiresOn, offsets, onDate, onOffsets }: Props) {
  const [custom, setCustom] = useState("");
  const all = [...new Set([...PRESETS, ...offsets])].sort((a, b) => b - a);
  const toggle = (d: number) =>
    onOffsets(offsets.includes(d) ? offsets.filter((o) => o !== d) : [...offsets, d]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label={s.expiry}
          value={expiresOn ?? ""}
          onChange={(e) => onDate(e.target.value)}
          className="h-9 flex-1 rounded-xl border border-stroke bg-white/[0.04] px-3 text-[13px] text-fg"
        />
        {expiresOn && (
          <button
            type="button"
            aria-label={`${strings.common.clear} ${s.expiry}`}
            onClick={() => onDate("")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-fg-3 hover:bg-white/[0.06] hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {expiresOn ? (
        <ExpiryBadge date={expiresOn} className="self-start" />
      ) : (
        <p className="text-[12px] text-fg-3">{s.noExpiry}</p>
      )}
      {expiresOn && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[12px] text-fg-2">{s.reminders}</legend>
          <div className="flex flex-wrap gap-1.5">
            {all.map((d) => {
              const on = offsets.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-[12px] transition-colors",
                    on
                      ? "bg-white font-medium text-black"
                      : "border border-line text-fg-2 hover:text-fg",
                  )}
                >
                  {s.daysBefore(d)}
                </button>
              );
            })}
            <form
              className="flex items-center"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(custom);
                if (Number.isInteger(n) && n > 0 && n <= 3650 && !offsets.includes(n))
                  onOffsets([...offsets, n]);
                setCustom("");
              }}
            >
              <input
                type="number"
                min={1}
                max={3650}
                aria-label={s.customDays}
                placeholder={s.customDays}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="h-7 w-16 rounded-l-full border border-line bg-transparent px-2.5 text-[12px] text-fg"
              />
              <button
                type="submit"
                aria-label={strings.common.add}
                className="flex h-7 w-7 items-center justify-center rounded-r-full border border-l-0 border-line text-fg-2 hover:text-fg"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </fieldset>
      )}
    </div>
  );
}
