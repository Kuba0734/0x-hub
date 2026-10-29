import { useEffect, useState, type FormEvent } from "react";
import { GlassButton, GlassSelect, GlassToggle } from "@/components/glass";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ipc, toIpcError, type AppSettings } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useSession } from "@/stores/session";
import { toast } from "@/stores/toasts";
import { SettingRow, SettingsGroup } from "../components/SettingsGroup";
import { useSettingsPatch } from "../useSettingsPatch";

const s = strings.settings;
const AUTO_LOCK = [0, 1, 5, 10, 15, 30, 60];

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if ([...next].length < 8) return setError(strings.onboarding.tooShort);
    setBusy(true);
    setError(null);
    try {
      await ipc.vault.changePassword(current, next);
      setCurrent("");
      setNext("");
      toast.show(s.passwordChanged);
    } catch (err) {
      const ie = toIpcError(err);
      setError(ie.code === "wrong_password" ? strings.lock.wrong : ie.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
      <PasswordInput
        label={s.currentPassword}
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <PasswordInput
        label={s.newPassword}
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <GlassButton type="submit" variant="primary" disabled={!current || !next || busy}>
        {s.changePassword}
      </GlassButton>
      {error && (
        <p role="alert" className="col-span-3 text-[12px] font-medium">
          {error}
        </p>
      )}
    </form>
  );
}

function HelloToggle() {
  const enabled = useSession((st) => st.helloEnabled);
  const refresh = useSession((st) => st.refresh);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ipc.hello.available().then(setAvailable, () => setAvailable(false));
  }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) await ipc.hello.enable();
      else await ipc.hello.disable();
      toast.show(on ? s.helloOn : s.helloOff);
      await refresh();
    } catch (e) {
      const err = toIpcError(e);
      if (err.code !== "hello_cancelled") toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassToggle
      label={s.hello}
      description={available === false ? s.helloUnavailable : s.helloHint}
      checked={enabled}
      disabled={busy || (available === false && !enabled)}
      onChange={(v) => void toggle(v)}
    />
  );
}

export function SecuritySection({ settings }: { settings: AppSettings }) {
  const patch = useSettingsPatch();
  return (
    <>
      <SettingsGroup title={s.changePassword}>
        <ChangePassword />
      </SettingsGroup>
      <SettingsGroup title={s.sections.security}>
        <HelloToggle />
        <SettingRow label={s.autoLock}>
          <GlassSelect<string>
            label={s.autoLock}
            value={String(settings.autoLockMinutes)}
            onChange={(v) => void patch({ autoLockMinutes: Number(v) })}
            options={AUTO_LOCK.map((m) => ({
              value: String(m),
              label: m === 0 ? s.autoLockNever : s.minutes(m),
            }))}
          />
        </SettingRow>
        <GlassToggle
          label={s.lockOnSessionLock}
          checked={settings.lockOnSessionLock}
          onChange={(v) => void patch({ lockOnSessionLock: v })}
        />
        <GlassToggle
          label={s.blurPreviews}
          description={s.blurPreviewsHint}
          checked={settings.blurPreviews}
          onChange={(v) => void patch({ blurPreviews: v })}
        />
      </SettingsGroup>
    </>
  );
}
