import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/glass";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ipc, toIpcError } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useSession } from "@/stores/session";
import { toast } from "@/stores/toasts";

export function RecoveryForm({ onBack }: { onBack: () => void }) {
  const refresh = useSession((s) => s.refresh);
  const [key, setKey] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if ([...pw].length < 8) return setError(strings.onboarding.tooShort);
    setBusy(true);
    setError(null);
    try {
      await ipc.vault.recover(key, pw);
      toast.show(strings.settings.passwordChanged);
      await refresh();
    } catch (err) {
      setError(toIpcError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <GlassInput
        label={strings.lock.recoveryKey}
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="font-mono text-[13px]"
        spellCheck={false}
        autoComplete="off"
        data-autofocus
      />
      <PasswordInput
        label={strings.lock.newPassword}
        autoComplete="new-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        error={error}
      />
      <GlassButton type="submit" variant="primary" size="lg" disabled={!key || !pw || busy}>
        {strings.lock.recover}
      </GlassButton>
      <button
        type="button"
        onClick={onBack}
        className="mx-auto text-[12px] text-fg-3 hover:text-fg-2"
      >
        {strings.lock.backToPassword}
      </button>
    </form>
  );
}
