import { useNavigate } from "react-router";
import { Bell, CalendarClock } from "lucide-react";
import { cn, formatDate, urgency } from "@/lib/format";
import { strings } from "@/lib/strings";
import type { TimelineEntry } from "../overviewData";

/** Vertical timeline of upcoming expiries and reminders. Urgency = brightness + weight. */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const navigate = useNavigate();
  if (!entries.length)
    return (
      <p className="py-6 text-center text-[13px] text-fg-3">{strings.overview.nothingUpcoming}</p>
    );
  return (
    <ol className="relative ml-2 border-l border-white/10">
      {entries.map((e) => {
        const u = urgency(e.days);
        const Icon = e.kind === "expiry" ? CalendarClock : Bell;
        return (
          <li key={`${e.doc.id}-${e.kind}-${e.date}`} className="relative pl-5">
            <span
              className={cn(
                "absolute top-3.5 -left-[5px] h-[9px] w-[9px] rounded-full border",
                u === "critical"
                  ? "urgent-pulse border-white bg-white"
                  : u === "soon"
                    ? "border-white/70 bg-white/50"
                    : "border-white/30 bg-black",
              )}
            />
            <button
              type="button"
              onClick={() => navigate(`/documents/${e.doc.id}`)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-white/[0.05]"
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", e.kind === "expiry" ? "text-fg" : "text-fg-3")}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[13px]",
                    u === "critical" ? "font-semibold text-fg" : "text-fg",
                  )}
                >
                  {e.doc.title}
                </span>
                <span className="block text-[11px] text-fg-3">
                  {e.kind === "expiry" ? strings.documents.expiry : strings.documents.reminders} ·{" "}
                  {formatDate(e.date)}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-[12px]",
                  u === "critical" ? "font-semibold text-fg" : "text-fg-2",
                )}
              >
                {strings.overview.inDays(e.days)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
