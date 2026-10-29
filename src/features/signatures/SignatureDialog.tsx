import { useRef, useState } from "react";
import { ImageUp, PenLine } from "lucide-react";
import { GlassButton, GlassDialog } from "@/components/glass";
import { cn } from "@/lib/format";
import { dialogs } from "@/lib/platform";
import { strings } from "@/lib/strings";
import { useSignatureMutations } from "./queries";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

const s = strings.signatures;

/** Add a signature: draw it, or import a photo/scan of one. */
export function SignatureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);
  const { create } = useSignatureMutations();

  const saveDrawing = async () => {
    const png = await pad.current?.toPng();
    if (!png) return;
    create.mutate({ png }, { onSuccess: onClose });
  };

  const importPhoto = async () => {
    const path = await dialogs.pickImage();
    if (path) create.mutate({ path }, { onSuccess: onClose });
  };

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      title={s.add}
      description={s.padHint}
      width={560}
      footer={
        <>
          <GlassButton
            variant="ghost"
            icon={<ImageUp />}
            onClick={importPhoto}
            disabled={create.isPending}
            className="mr-auto"
          >
            {s.import}
          </GlassButton>
          <GlassButton variant="ghost" onClick={() => pad.current?.clear()} disabled={empty}>
            {s.clear}
          </GlassButton>
          <GlassButton
            variant="primary"
            icon={<PenLine />}
            onClick={saveDrawing}
            disabled={empty || create.isPending}
          >
            {create.isPending ? strings.common.loading : s.save}
          </GlassButton>
        </>
      }
    >
      <div className={cn(create.isPending && "pointer-events-none opacity-60")}>
        <SignaturePad ref={pad} onChange={setEmpty} />
        <p className="mt-3 text-[12px] text-fg-3">{s.importHint}</p>
      </div>
    </GlassDialog>
  );
}
