import { useState, type FormEvent } from "react";
import { Fingerprint, Lock } from "lucide-react";
import { GlassButton, GlassPanel } from "@/components/glass";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { toIpcError } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useSession } from "@/stores/session";

interface Props {
  title: string;
  /** Re-confirms identity; without a password the backend uses Windows Hello. */
  onReveal: (password?: string) => Promise<void>;
}

/** Shown in place of locked content until the user confirms it's them. */
export function RevealGate({ title, onReveal }: Props) {
  const helloEnabled = useSession((st) => st.helloEnabled);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = strings.documents;

  const reveal = async (password?: string) => {
    setBusy(true);
    setError(null);
    try {
      await onReveal(password);
      setPw("");
    } catch (e) {
      const err = toIpcError(e);
      if (err.code !== "hello_cancelled")
        setError(err.code === "wrong_password" ? strings.lock.wrong : err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pw) void reveal(pw);
  };

  return (
    <GlassPanel refract={false} className="flex flex-1 items-center justify-center p-8">
      <form
        onSubmit={submit}
        className="flex w-full max-w-[340px] flex-col items-center gap-4 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-stroke bg-white/[0.07]">
          <Lock className="h-5 w-5" />
        </div>
        <h2 className="text-[20px]">{title}</h2>
        <p className="text-[13px] leading-relaxed text-fg-2">{s.lockedBody}</p>
        <PasswordInput
          label={s.revealPassword}
          hideLabel
          placeholder={s.revealPassword}
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          error={error}
          wrapperClassName="w-full"
          disabled={busy}
          autoFocus
        />
        <GlassButton
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!pw || busy}
        >
          {s.revealOpen}
        </GlassButton>
        {helloEnabled && (
          <GlassButton
            type="button"
            size="lg"
            className="w-full"
            icon={<Fingerprint />}
            onClick={() => void reveal()}
            disabled={busy}
          >
            {s.revealHello}
          </GlassButton>
        )}
      </form>
    </GlassPanel>
  );
}
