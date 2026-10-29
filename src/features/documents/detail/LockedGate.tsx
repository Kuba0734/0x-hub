import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Fingerprint, Lock } from "lucide-react";
import { GlassButton, GlassPanel } from "@/components/glass";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ipc, toIpcError, type DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useSession } from "@/stores/session";
import { docKeys } from "../queries";

const s = strings.documents;

/** Shown instead of preview and details until the user re-confirms identity. */
export function LockedGate({ doc }: { doc: DocumentItem }) {
  const qc = useQueryClient();
  const helloEnabled = useSession((st) => st.helloEnabled);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reveal = async (password?: string) => {
    setBusy(true);
    setError(null);
    try {
      await ipc.documents.reveal(doc.id, password);
      setPw("");
      await qc.invalidateQueries({ queryKey: docKeys.all });
    } catch (e) {
      const err = toIpcError(e);
      if (err.code === "hello_cancelled") return;
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
        <h2 className="text-[20px]">{s.lockedTitle}</h2>
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
