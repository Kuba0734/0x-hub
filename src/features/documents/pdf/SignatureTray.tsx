import { useState } from "react";
import { Plus } from "lucide-react";
import { GlassButton } from "@/components/glass";
import type { Signature } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useSignatures } from "@/features/signatures/queries";
import { SignatureDialog } from "@/features/signatures/SignatureDialog";
import { SignatureImage } from "@/features/signatures/SignatureImage";

const s = strings.signatures;

/** Stored signatures to place on the current page, plus "Add signature". */
export function SignatureTray({ onPick }: { onPick: (sig: Signature) => void }) {
  const { data: signatures = [] } = useSignatures();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex w-48 shrink-0 flex-col gap-2 overflow-y-auto">
      <p className="text-[12px] font-medium text-fg-2">{s.title}</p>
      {signatures.length === 0 && <p className="text-[12px] text-fg-3">{s.empty}</p>}
      {signatures.map((sig, i) => (
        <button
          key={sig.id}
          type="button"
          aria-label={s.pick(i + 1)}
          onClick={() => onPick(sig)}
          className="h-16 rounded-xl border border-line p-1 transition-colors hover:border-white/40"
        >
          <SignatureImage id={sig.id} className="h-full w-full" />
        </button>
      ))}
      <GlassButton size="sm" variant="ghost" icon={<Plus />} onClick={() => setAdding(true)}>
        {s.add}
      </GlassButton>
      <SignatureDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
