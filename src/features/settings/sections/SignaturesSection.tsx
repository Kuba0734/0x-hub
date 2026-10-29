import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDate } from "@/lib/format";
import { strings } from "@/lib/strings";
import { useSignatureMutations, useSignatures } from "@/features/signatures/queries";
import { SignatureDialog } from "@/features/signatures/SignatureDialog";
import { SignatureImage } from "@/features/signatures/SignatureImage";
import { SettingsGroup } from "../components/SettingsGroup";

const s = strings.signatures;

export function SignaturesSection() {
  const { data: signatures = [] } = useSignatures();
  const { remove } = useSignatureMutations();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  return (
    <SettingsGroup title={s.title} description={s.description}>
      {signatures.length === 0 && <p className="text-[13px] text-fg-3">{s.empty}</p>}
      <div className="grid grid-cols-2 gap-3">
        {signatures.map((sig, i) => (
          <div key={sig.id} className="flex flex-col gap-2 rounded-2xl border border-line p-3">
            <SignatureImage id={sig.id} className="h-20" />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-fg-3">
                {s.pick(i + 1)} · {formatDate(sig.createdAt)}
              </span>
              <GlassButton
                size="sm"
                variant="ghost"
                iconOnly
                icon={<Trash2 />}
                aria-label={s.delete}
                onClick={() => setDeleting(sig.id)}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <GlassButton size="sm" icon={<Plus />} onClick={() => setAdding(true)}>
          {s.add}
        </GlassButton>
      </div>
      <SignatureDialog open={adding} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={deleting !== null}
        title={s.confirmDelete}
        body={s.confirmDeleteBody}
        confirmLabel={strings.common.delete}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </SettingsGroup>
  );
}
