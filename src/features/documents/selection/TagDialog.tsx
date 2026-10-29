import { useState } from "react";
import { GlassButton, GlassDialog, GlassInput } from "@/components/glass";
import { strings } from "@/lib/strings";

const s = strings.documents;

export function TagDialog({
  count,
  open,
  onClose,
  onAdd,
}: {
  count: number;
  open: boolean;
  onClose: () => void;
  onAdd: (tag: string) => void;
}) {
  const [tag, setTag] = useState("");
  const submit = () => {
    const t = tag.trim().replace(/^#/, "").toLowerCase();
    if (t) onAdd(t);
    setTag("");
    onClose();
  };
  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      title={s.tagDialogTitle(count)}
      width={380}
      footer={
        <>
          <GlassButton variant="ghost" onClick={onClose}>
            {strings.common.cancel}
          </GlassButton>
          <GlassButton variant="primary" onClick={submit} disabled={!tag.trim()}>
            {strings.common.add}
          </GlassButton>
        </>
      }
    >
      <GlassInput
        label={s.tags}
        hideLabel
        placeholder={s.tagPlaceholder}
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        data-autofocus
      />
    </GlassDialog>
  );
}
