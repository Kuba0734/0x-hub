import { useState, type FormEvent } from "react";
import { GlassButton } from "@/components/glass";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ipc, toIpcError } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useSession } from "@/stores/session";
import { StrengthMeter } from "./StrengthMeter";

export function PasswordStep({ onCreated }: { onCreated: (recoveryKey: string) => void }) {
  const s = strings.onboarding;
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setOnboardingActive = useSession((st) => st.setOnboardingActive);

  const tooShort = pw.length > 0 && [...pw].length < 8;
  const mismatch = confirm.length > 0 && confirm !== pw;
  const valid = [...pw].length >= 8 && pw === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      setOnboardingActive(true);
      const key = await ipc.vault.setup(pw);
      onCreated(key);
    } catch (err) {
      setError(toIpcError(err).message || strings.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h1 className="text-[28px]">{s.passwordTitle}</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-fg-2">{s.passwordBody}</p>
      <div className="mt-6 flex flex-col gap-4">
        <PasswordInput
          label={s.password}
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          error={tooShort ? s.tooShort : null}
          data-autofocus
        />
        <StrengthMeter password={pw} />
        <PasswordInput
          label={s.confirmPassword}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? s.mismatch : error}
        />
      </div>
      <div className="mt-8 flex justify-end">
        <GlassButton type="submit" variant="primary" size="lg" disabled={!valid || busy}>
          {busy ? s.creating : strings.common.next}
        </GlassButton>
      </div>
    </form>
  );
}
