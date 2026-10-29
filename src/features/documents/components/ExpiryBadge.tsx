import { AlarmClock, CalendarClock, CalendarX2 } from "lucide-react";
import { cn, daysUntil, formatDate, urgency } from "@/lib/format";
import { strings } from "@/lib/strings";

/** Urgency is shown with brightness, weight, icon and a soft pulse — never color. */
export function ExpiryBadge({ date, className }: { date: string | null; className?: string }) {
  if (!date) return null;
  const days = daysUntil(date);
  const u = urgency(days);
  const Icon = u === "expired" ? CalendarX2 : u === "critical" ? AlarmClock : CalendarClock;
  const label =
    u === "expired"
      ? strings.documents.expiredOn(formatDate(date))
      : strings.documents.expiresIn(days);
  return (
    <span
      title={formatDate(date)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
        u === "expired" && "bg-white font-semibold text-black",
        u === "critical" && "border border-white/60 font-semibold text-fg",
        u === "soon" && "border border-white/20 font-medium text-fg",
        u === "later" && "text-fg-3",
        className,
      )}
    >
      <Icon className={cn("h-3 w-3", u === "critical" && "urgent-pulse")} />
      {label}
    </span>
  );
}
