import { useState } from "react";
import { CalendarDays, Check, Plus, Square, Type, X } from "lucide-react";
import { GlassButton, GlassTooltip } from "@/components/glass";
import type { Signature } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useSignatures } from "@/features/signatures/queries";
import { SignatureDialog } from "@/features/signatures/SignatureDialog";
import { SignatureImage } from "@/features/signatures/SignatureImage";

const s = strings.pdfTools;

export type TrayPick =
  | { kind: "text"; text: string }
  | { kind: "check" }
  | { kind: "cross" }
  | { kind: "cover" }
  | { kind: "signature"; signature: Signature };

const tile =
  "flex h-9 items-center gap-2 rounded-xl border border-line px-2.5 text-[12px] text-fg-2 transition-colors hover:border-white/40 hover:text-fg disabled:opacity-40";

/** Things to put on the current page: text, date, marks, white box and stored signatures. */
export function EditorTray({
  onPick,
  disabled,
}: {
  onPick: (p: TrayPick) => void;
  disabled: boolean;
}) {
  const { data: signatures = [] } = useSignatures();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex w-48 shrink-0 flex-col gap-2 overflow-y-auto pr-1">
      <p className="text-[12px] font-medium text-fg-2">{s.addTitle}</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          className={tile}
          disabled={disabled}
          onClick={() => onPick({ kind: "text", text: "" })}
        >
          <Type className="h-3.5 w-3.5" /> {s.addText}
        </button>
        <button
          type="button"
          className={tile}
          disabled={disabled}
          onClick={() => onPick({ kind: "text", text: new Date().toLocaleDateString() })}
        >
          <CalendarDays className="h-3.5 w-3.5" /> {s.addDate}
        </button>
        <button
          type="button"
          className={tile}
          disabled={disabled}
          onClick={() => onPick({ kind: "check" })}
        >
          <Check className="h-3.5 w-3.5" /> {s.addCheck}
        </button>
        <button
          type="button"
          className={tile}
          disabled={disabled}
          onClick={() => onPick({ kind: "cross" })}
        >
          <X className="h-3.5 w-3.5" /> {s.addCross}
        </button>
      </div>
      <GlassTooltip label={s.coverHint}>
        <button
          type="button"
          className={tile}
          disabled={disabled}
          onClick={() => onPick({ kind: "cover" })}
        >
          <Square className="h-3.5 w-3.5" /> {s.addCover}
        </button>
      </GlassTooltip>

      <p className="mt-3 text-[12px] font-medium text-fg-2">{strings.signatures.title}</p>
      {signatures.length === 0 && (
        <p className="text-[12px] text-fg-3">{strings.signatures.empty}</p>
      )}
      {signatures.map((sig, i) => (
        <button
          key={sig.id}
          type="button"
          aria-label={strings.signatures.pick(i + 1)}
          disabled={disabled}
          onClick={() => onPick({ kind: "signature", signature: sig })}
          className="h-16 shrink-0 rounded-xl border border-line p-1 transition-colors hover:border-white/40 disabled:opacity-40"
        >
          <SignatureImage id={sig.id} className="h-full w-full" />
        </button>
      ))}
      <GlassButton size="sm" variant="ghost" icon={<Plus />} onClick={() => setAdding(true)}>
        {strings.signatures.add}
      </GlassButton>
      <SignatureDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
