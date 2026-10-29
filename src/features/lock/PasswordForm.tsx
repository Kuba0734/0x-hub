import { motion, useAnimationControls } from "motion/react";
import { useState, type FormEvent } from "react";
import { Fingerprint } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ipc, toIpcError } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useSession } from "@/stores/session";
import { useReduceMotion } from "@/stores/settings";
import { useBackoff } from "./useBackoff";

export function PasswordForm({ onForgot }: { onForgot: () => void }) {
  const helloEnabled = useSession((s) => s.helloEnabled);
  const retryAfterMs = useSession((s) => s.retryAfterMs);
  const refresh = useSession((s) => s.refresh);
  const reduce = useReduceMotion();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backoff = useBackoff(retryAfterMs);
  const shake = useAnimationControls();

  const fail = (message: string) => {
    setError(message);
    if (!reduce) void shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.35 } });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw || busy || backoff.blocked) return;
    setBusy(true);
    setError(null);
    try {
      await ipc.vault.unlock(pw);
      setPw("");
      await refresh();
    } catch (err) {
      const ie = toIpcError(err);
      if (ie.retryAfterMs) backoff.start(ie.retryAfterMs);
      fail(ie.code === "wrong_password" ? strings.lock.wrong : ie.message);
    } finally {
      setBusy(false);
    }
  };

  const hello = async () => {
    setBusy(true);
    setError(null);
    try {
      await ipc.hello.unlock();
      await refresh();
    } catch (err) {
      const ie = toIpcError(err);
      if (ie.code !== "hello_cancelled") fail(ie.message);
    } finally {
      setBusy(false);
    }
  };

  const message = backoff.blocked ? strings.lock.waitSeconds(backoff.seconds) : error;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <motion.div animate={shake}>
        <PasswordInput
          label={strings.lock.password}
          hideLabel
          placeholder={strings.lock.password}
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          error={message}
          disabled={busy}
          data-autofocus
          autoFocus
        />
      </motion.div>
      <GlassButton
        type="submit"
        variant="primary"
        size="lg"
        disabled={!pw || busy || backoff.blocked}
      >
        {busy ? strings.lock.unlocking : strings.lock.unlock}
      </GlassButton>
      {helloEnabled && (
        <GlassButton type="button" size="lg" icon={<Fingerprint />} onClick={hello} disabled={busy}>
          {strings.lock.hello}
        </GlassButton>
      )}
      <button
        type="button"
        onClick={onForgot}
        className="mx-auto text-[12px] text-fg-3 hover:text-fg-2"
      >
        {strings.lock.forgot}
      </button>
    </form>
  );
}
