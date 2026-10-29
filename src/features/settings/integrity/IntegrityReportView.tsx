import { CircleCheck, FileWarning, HardDrive } from "lucide-react";
import { useNavigate } from "react-router";
import { formatDateTime } from "@/lib/format";
import type { IntegrityProblem, IntegrityReport } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useDocuments } from "@/features/documents/queries";
import { useNotes } from "@/features/notes/queries";

const s = strings.integrity;

/** Titles for ids in the report (active and trashed items); nothing is decrypted here. */
function useTitles() {
  const lists = [useDocuments(false), useDocuments(true)].flatMap((q) => q.data ?? []);
  const notes = [useNotes(false), useNotes(true)].flatMap((q) => q.data ?? []);
  const titles = new Map<string, { title: string; path: string }>();
  for (const d of lists) titles.set(d.id, { title: d.title, path: `/documents/${d.id}` });
  for (const n of notes)
    titles.set(n.id, { title: n.title || strings.common.untitled, path: `/notes/${n.id}` });
  return titles;
}

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

function ProblemRow({ p, titles }: { p: IntegrityProblem; titles: ReturnType<typeof useTitles> }) {
  const navigate = useNavigate();
  const item = p.itemId ? titles.get(p.itemId) : undefined;
  const subject = item?.title ?? (p.path ? fileName(p.path) : p.itemId ? s.unknownItem : "");
  return (
    <li className="flex items-start gap-3 rounded-xl px-2 py-2">
      <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-fg" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-fg">{s.kinds[p.kind] ?? p.kind}</p>
        {subject &&
          (item ? (
            <button
              type="button"
              onClick={() => navigate(item.path)}
              className="truncate text-[12px] text-fg-2 underline-offset-2 hover:text-fg hover:underline"
            >
              {subject}
            </button>
          ) : (
            <p className="truncate text-[12px] text-fg-2" title={p.path ?? undefined}>
              {subject}
            </p>
          ))}
        {p.detail && <p className="truncate font-mono text-[11px] text-fg-3">{p.detail}</p>}
      </div>
    </li>
  );
}

export function IntegrityReportView({ report }: { report: IntegrityReport }) {
  const titles = useTitles();
  const ok = report.problems.length === 0;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
      <div className="flex items-center gap-2.5">
        {ok ? (
          <CircleCheck className="h-5 w-5 text-fg" aria-hidden />
        ) : (
          <FileWarning className="h-5 w-5 text-fg" aria-hidden />
        )}
        <div>
          <p className="text-[14px] font-semibold">
            {ok ? s.allGood : s.problems(report.problems.length)}
          </p>
          <p className="text-[12px] text-fg-3">
            {s.lastRun(formatDateTime(report.ranAt))} · {s.summary(report.documents, report.notes)}
            {report.backups.length > 0 && ` · ${s.backupsChecked(report.backups.length)}`}
          </p>
        </div>
      </div>
      {!ok && (
        <>
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {report.problems.map((p, i) => (
              <ProblemRow key={i} p={p} titles={titles} />
            ))}
          </ul>
          <p className="text-[12px] text-fg-2">{s.advice}</p>
        </>
      )}
      {report.backups.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-line pt-3">
          {report.backups.map((b) => (
            <li key={b.path} className="flex items-center gap-2 text-[12px]">
              <HardDrive className="h-3.5 w-3.5 shrink-0 text-fg-3" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-mono text-fg-2" title={b.path}>
                {fileName(b.path)}
              </span>
              <span className={b.ok ? "text-fg-3" : "font-semibold text-fg"}>
                {b.ok ? (b.decrypted ? s.backupDecrypted : s.backupOk) : s.backupBad}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
