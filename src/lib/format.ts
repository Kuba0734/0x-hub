const DAY_MS = 24 * 60 * 60 * 1000;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(input: number | string | Date): string {
  return dateFmt.format(typeof input === "string" ? parseLocalDate(input) : new Date(input));
}

export function formatDateTime(ms: number): string {
  return dateTimeFmt.format(new Date(ms));
}

/** Parses `YYYY-MM-DD` as a local date (not UTC). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole calendar days from `today` until `iso` (negative when past). */
export function daysUntil(iso: string, today: Date = new Date()): number {
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((parseLocalDate(iso).getTime() - a) / DAY_MS);
}

export type Urgency = "expired" | "critical" | "soon" | "later";

/** Urgency drives brightness/weight/pulse in the UI, never color. */
export function urgency(days: number): Urgency {
  if (days < 0) return "expired";
  if (days <= 7) return "critical";
  if (days <= 30) return "soon";
  return "later";
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(ms: number, now: number = Date.now()): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < DAY_MS) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 7 * DAY_MS) return rtf.format(Math.round(diff / DAY_MS), "day");
  return formatDate(ms);
}

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

const MARK_START = String.fromCharCode(2);
const MARK_END = String.fromCharCode(3);

/** Splits a search snippet with \u0002…\u0003 highlight markers (from the backend) into segments. */
export function parseSnippet(snippet: string): { text: string; hit: boolean }[] {
  const out: { text: string; hit: boolean }[] = [];
  let pos = 0;
  while (pos < snippet.length) {
    const start = snippet.indexOf(MARK_START, pos);
    if (start === -1) break;
    const end = snippet.indexOf(MARK_END, start + 1);
    if (end === -1) break;
    if (start > pos) out.push({ text: snippet.slice(pos, start), hit: false });
    out.push({ text: snippet.slice(start + 1, end), hit: true });
    pos = end + 1;
  }
  if (pos < snippet.length) out.push({ text: snippet.slice(pos), hit: false });
  return out;
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
