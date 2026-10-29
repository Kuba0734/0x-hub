import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { ipc, toIpcError } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";

export function HelloStep({ onNext }: { onNext: () => void }) {
  const s = strings.onboarding;
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ipc.hello.available().then(setAvailable, () => setAvailable(false));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      await ipc.hello.enable();
      toast.show(strings.settings.helloOn);
      onNext();
    } catch (e) {
      const err = toIpcError(e);
      if (err.code !== "hello_cancelled") toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-stroke bg-white/[0.06]">
        <Fingerprint className="h-6 w-6" />
      </div>
      <h1 className="text-[28px]">{s.helloTitle}</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-fg-2">
        {available === false ? s.helloUnavailable : s.helloBody}
      </p>
      <div className="mt-8 flex justify-end gap-2">
        <GlassButton variant="ghost" onClick={onNext}>
          {available === false ? strings.common.next : s.helloSkip}
        </GlassButton>
        {available && (
          <GlassButton variant="primary" onClick={enable} disabled={busy} data-autofocus>
            {s.helloEnable}
          </GlassButton>
        )}
      </div>
    </div>
  );
}
