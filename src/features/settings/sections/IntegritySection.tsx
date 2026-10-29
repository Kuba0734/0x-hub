import { useState } from "react";
import { FileSearch, ShieldCheck } from "lucide-react";
import { GlassButton, GlassSelect, GlassToggle } from "@/components/glass";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ipc, toIpcError, type AppSettings } from "@/lib/ipc";
import { dialogs } from "@/lib/platform";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { SettingRow, SettingsGroup } from "../components/SettingsGroup";
import { IntegrityReportView } from "../integrity/IntegrityReportView";
import { useIntegrity } from "../integrity/useIntegrity";
import { useSettingsPatch } from "../useSettingsPatch";

const s = strings.integrity;

export function IntegritySection({ settings }: { settings: AppSettings }) {
  const patch = useSettingsPatch();
  const { report, progress, run } = useIntegrity();
  const [checkingFile, setCheckingFile] = useState(false);
  const it = settings.integrity;
  const busy = progress !== null || run.isPending;

  const checkFile = async () => {
    const path = await dialogs.pickBackup();
    if (!path) return;
    setCheckingFile(true);
    try {
      const r = await ipc.integrity.checkBackup(path);
      if (r.problems.length === 0) toast.show(r.decrypted ? s.fileOk : s.fileOkStructural);
      else
        toast.error(
          `${s.problems(r.problems.length)}: ${r.problems.map((p) => s.kinds[p.kind]).join(", ")}`,
        );
    } catch (e) {
      toast.error(toIpcError(e).message);
    } finally {
      setCheckingFile(false);
    }
  };

  return (
    <SettingsGroup title={s.title} description={s.description}>
      <GlassToggle
        label={s.enabled}
        checked={it.enabled}
        onChange={(v) => void patch({ integrity: { enabled: v } })}
      />
      <SettingRow label={s.every}>
        <GlassSelect<string>
          label={s.every}
          value={String(it.intervalDays)}
          onChange={(v) => void patch({ integrity: { intervalDays: Number(v) } })}
          options={[1, 7, 14, 30].map((d) => ({
            value: String(d),
            label: strings.settings.days(d),
          }))}
        />
      </SettingRow>
      <GlassToggle
        label={s.includeBackups}
        description={s.includeBackupsHint}
        checked={it.includeBackups}
        onChange={(v) => void patch({ integrity: { includeBackups: v } })}
      />
      {busy && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <ProgressBar
            value={progress?.total ? progress.done / progress.total : 0}
            label={s.title}
          />
          <p className="text-[12px] text-fg-3">
            {s.running(progress?.done ?? 0, progress?.total ?? 0)}
          </p>
        </div>
      )}
      {!busy && report && <IntegrityReportView report={report} />}
      {!busy && !report && <p className="text-[13px] text-fg-3">{s.neverRun}</p>}
      <div className="flex justify-end gap-2">
        <GlassButton size="sm" icon={<FileSearch />} onClick={checkFile} disabled={checkingFile}>
          {checkingFile ? strings.common.loading : s.checkFile}
        </GlassButton>
        <GlassButton
          size="sm"
          variant="primary"
          icon={<ShieldCheck />}
          onClick={() => run.mutate()}
          disabled={busy}
        >
          {s.runNow}
        </GlassButton>
      </div>
    </SettingsGroup>
  );
}
