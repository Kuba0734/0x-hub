import { useState } from "react";
import { ArchiveRestore, Download, FolderOpen } from "lucide-react";
import { GlassButton, GlassDialog, GlassSelect, GlassToggle } from "@/components/glass";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { formatDateTime, toIsoDate } from "@/lib/format";
import { ipc, toIpcError, type AppSettings } from "@/lib/ipc";
import { dialogs } from "@/lib/platform";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { SettingRow, SettingsGroup } from "../components/SettingsGroup";
import { useSettingsPatch } from "../useSettingsPatch";

const s = strings.settings;

function RestoreDialog({ source, onClose }: { source: string | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restore = async () => {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      await ipc.backup.import(source, password);
      toast.show(s.restoreDone);
      setPassword("");
      onClose();
    } catch (e) {
      const err = toIpcError(e);
      setError(err.code === "wrong_password" ? strings.lock.wrong : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassDialog
      open={source !== null}
      onClose={onClose}
      dismissible={!busy}
      title={s.backupImport}
      description={s.restoreConfirm}
      footer={
        <>
          <GlassButton variant="ghost" onClick={onClose} disabled={busy}>
            {strings.common.cancel}
          </GlassButton>
          <GlassButton variant="primary" onClick={restore} disabled={!password || busy}>
            {busy ? strings.common.loading : s.backupImport}
          </GlassButton>
        </>
      }
    >
      <p className="mb-4 truncate font-mono text-[12px] text-fg-3">{source}</p>
      <PasswordInput
        label={s.backupPassword}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
        data-autofocus
      />
    </GlassDialog>
  );
}

export function BackupSection({ settings }: { settings: AppSettings }) {
  const patch = useSettingsPatch();
  const [restoreFrom, setRestoreFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ab = settings.autoBackup;

  const exportNow = async () => {
    const target = await dialogs.saveFile(`0x-hub-${toIsoDate(new Date())}.0xbackup`, [
      { name: "0x-hub backup", extensions: ["0xbackup"] },
    ]);
    if (!target) return;
    setBusy(true);
    try {
      await ipc.backup.export(target);
      toast.show(s.backupDone);
    } catch (e) {
      toast.error(toIpcError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const pickFolder = async () => {
    const folder = await dialogs.pickFolder();
    if (folder) await patch({ autoBackup: { folder } });
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const path = await ipc.backup.runAuto();
      if (path) toast.show(s.backupDone);
      await patch({});
    } catch (e) {
      toast.error(toIpcError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingsGroup title={s.sections.backup}>
        <SettingRow label={s.backupExport} description={s.backupExportHint}>
          <GlassButton icon={<Download />} onClick={exportNow} disabled={busy}>
            {s.backupExport}
          </GlassButton>
        </SettingRow>
        <SettingRow label={s.backupImport} description={s.backupImportHint}>
          <GlassButton
            icon={<ArchiveRestore />}
            onClick={async () => setRestoreFrom(await dialogs.pickBackup())}
            disabled={busy}
          >
            {s.backupImport}
          </GlassButton>
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup
        title={s.autoBackup}
        description={ab.lastRunAt ? s.lastBackup(formatDateTime(ab.lastRunAt)) : s.neverBackedUp}
      >
        <GlassToggle
          label={s.autoBackup}
          checked={ab.enabled}
          onChange={(v) => void patch({ autoBackup: { enabled: v } })}
        />
        <SettingRow label={s.autoBackupFolder} description={ab.folder ?? undefined}>
          <GlassButton size="sm" icon={<FolderOpen />} onClick={pickFolder}>
            {s.chooseFolder}
          </GlassButton>
        </SettingRow>
        <SettingRow label={s.every}>
          <GlassSelect<string>
            label={s.every}
            value={String(ab.intervalDays)}
            onChange={(v) => void patch({ autoBackup: { intervalDays: Number(v) } })}
            options={[1, 3, 7, 14, 30].map((d) => ({ value: String(d), label: s.days(d) }))}
          />
        </SettingRow>
        <div className="flex justify-end">
          <GlassButton size="sm" onClick={runNow} disabled={busy || !ab.enabled || !ab.folder}>
            {s.runBackupNow}
          </GlassButton>
        </div>
      </SettingsGroup>
      <RestoreDialog source={restoreFrom} onClose={() => setRestoreFrom(null)} />
    </>
  );
}
