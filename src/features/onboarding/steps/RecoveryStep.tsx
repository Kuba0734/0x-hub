import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { AnimatedCheck } from "@/components/ui/AnimatedCheck";
import { ipc, toIpcError } from "@/lib/ipc";
import { dialogs } from "@/lib/platform";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";

export function RecoveryStep({ recoveryKey, onNext }: { recoveryKey: string; onNext: () => void }) {
  const s = strings.onboarding;
  const [confirmed, setConfirmed] = useState(false);

  const saveFile = async () => {
    try {
      const path = await dialogs.saveFile("0x-hub-recovery-key.txt", [
        { name: "Text", extensions: ["txt"] },
      ]);
      if (!path) return;
      await ipc.app.saveTextFile(path, `${s.recoveryFileHeader}${recoveryKey}\n`);
      toast.show(strings.common.saved);
    } catch (e) {
      toast.error(toIpcError(e).message);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(recoveryKey);
    toast.show(strings.common.copied);
  };

  return (
    <div>
      <h1 className="text-[28px]">{s.recoveryTitle}</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-fg-2">{s.recoveryBody}</p>
      <div className="mt-6 rounded-2xl border border-white/15 bg-black/40 p-4 font-mono text-[15px] leading-loose tracking-wider text-fg select-text">
        {recoveryKey}
      </div>
      <div className="mt-4 flex gap-2">
        <GlassButton size="sm" icon={<Download />} onClick={saveFile}>
          {s.saveAsFile}
        </GlassButton>
        <GlassButton size="sm" variant="ghost" icon={<Copy />} onClick={copy}>
          {s.copyKey}
        </GlassButton>
      </div>
      <label className="mt-6 flex cursor-pointer items-center gap-3 text-[13px] text-fg">
        <AnimatedCheck checked={confirmed} onChange={setConfirmed} label={s.recoveryConfirm} />
        <span aria-hidden="true">{s.recoveryConfirm}</span>
      </label>
      <div className="mt-8 flex justify-end">
        <GlassButton variant="primary" size="lg" disabled={!confirmed} onClick={onNext}>
          {strings.common.next}
        </GlassButton>
      </div>
    </div>
  );
}
