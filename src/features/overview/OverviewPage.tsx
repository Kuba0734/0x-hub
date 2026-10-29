import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  AlarmClock,
  CheckSquare,
  FileText,
  HardDrive,
  NotebookPen,
  StickyNote,
  Upload,
} from "lucide-react";
import { GlassButton, GlassPanel } from "@/components/glass";
import { StaggerItem, StaggerList } from "@/components/motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { dayPart, formatBytes } from "@/lib/format";
import { ipc } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useUi } from "@/stores/ui";
import { useDocuments } from "@/features/documents/queries";
import { useNotes } from "@/features/notes/queries";
import { useNewNote } from "@/features/notes/useNewNote";
import { ItemList } from "./components/ItemList";
import { StatCard } from "./components/StatCard";
import { Timeline } from "./components/Timeline";
import { pinned, recent, toItems, upcoming } from "./overviewData";
import { useClock } from "./useClock";

const s = strings.overview;
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <GlassPanel refract={false} radius={20} className={`flex flex-col p-5 ${className ?? ""}`}>
      <h2 className="mb-3 text-[13px] font-medium tracking-normal text-fg-2">{title}</h2>
      <div className="min-h-0 flex-1">{children}</div>
    </GlassPanel>
  );
}

export function OverviewPage() {
  const now = useClock();
  const navigate = useNavigate();
  const newNote = useNewNote();
  const requestUpload = useUi((st) => st.requestUpload);
  const stats = useQuery({ queryKey: ["overview"], queryFn: ipc.app.overview });
  const docs = useDocuments();
  const notes = useNotes();

  const items = useMemo(() => toItems(docs.data ?? [], notes.data ?? []), [docs.data, notes.data]);
  const timeline = useMemo(() => upcoming(docs.data ?? []), [docs.data]);
  const loading = docs.isLoading || notes.isLoading;

  const upload = () => {
    requestUpload();
    navigate("/documents");
  };

  return (
    <div className="h-full overflow-y-auto px-8 pt-8 pb-10">
      <StaggerList className="flex flex-col gap-5">
        <StaggerItem className="flex items-end justify-between">
          <div>
            <p className="text-[13px] text-fg-2">{dateFmt.format(now)}</p>
            <h1 className="mt-1 text-[40px] leading-tight">
              {s.greeting(dayPart(now.getHours()))}
            </h1>
          </div>
          <time
            className="tabular text-[40px] font-semibold tracking-[-0.03em] text-fg-2"
            dateTime={now.toISOString()}
          >
            {timeFmt.format(now)}
          </time>
        </StaggerItem>

        <StaggerItem className="grid grid-cols-4 gap-4">
          {stats.data ? (
            <>
              <StatCard label={s.documents} value={stats.data.documents} icon={<FileText />} />
              <StatCard label={s.notes} value={stats.data.notes} icon={<NotebookPen />} />
              <StatCard
                label={s.storage}
                value={stats.data.storageBytes}
                icon={<HardDrive />}
                format={(n) => formatBytes(Math.round(n))}
              />
              <StatCard
                label={s.expiringSoon}
                value={stats.data.expiringSoon}
                icon={<AlarmClock />}
                emphasis={stats.data.expiringSoon > 0}
              />
            </>
          ) : (
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-2xl" />
            ))
          )}
        </StaggerItem>

        <StaggerItem className="flex flex-wrap gap-2">
          <GlassButton variant="primary" icon={<NotebookPen />} onClick={() => newNote("markdown")}>
            {s.newNote}
          </GlassButton>
          <GlassButton icon={<Upload />} onClick={upload}>
            {s.upload}
          </GlassButton>
          <GlassButton icon={<StickyNote />} onClick={() => newNote("sticky")}>
            {s.quickSticky}
          </GlassButton>
          <GlassButton icon={<CheckSquare />} onClick={() => newNote("checklist")}>
            {s.newChecklist}
          </GlassButton>
        </StaggerItem>

        <StaggerItem className="grid grid-cols-3 gap-4">
          <Section title={s.recent}>
            {loading ? (
              <Skeleton className="h-48" />
            ) : (
              <ItemList items={recent(items)} empty={s.nothingRecent} />
            )}
          </Section>
          <Section title={s.pinned}>
            {loading ? (
              <Skeleton className="h-48" />
            ) : (
              <ItemList items={pinned(items).slice(0, 8)} empty={s.nothingPinned} />
            )}
          </Section>
          <Section title={s.upcoming}>
            {loading ? <Skeleton className="h-48" /> : <Timeline entries={timeline} />}
          </Section>
        </StaggerItem>
      </StaggerList>
    </div>
  );
}
