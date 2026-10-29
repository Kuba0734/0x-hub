import { useState } from "react";
import { GlassButton, GlassDialog, GlassInput } from "@/components/glass";
import { strings } from "@/lib/strings";

const s = strings.documents.folders;

interface Props {
  open: boolean;
  title: string;
  /** Pre-filled name (rename); empty for a new folder. */
  initial?: string;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

/** Name a new folder or rename one. */
export function FolderNameDialog({
  open,
  title,
  initial = "",
  confirmLabel,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState<string | null>(null);
  const value = name ?? initial;
  const close = () => {
    setName(null);
    onClose();
  };
  const submit = () => {
    const n = value.trim();
    if (!n) return;
    onSubmit(n);
    close();
  };
  return (
    <GlassDialog
      open={open}
      onClose={close}
      title={title}
      width={400}
      footer={
        <>
          <GlassButton variant="ghost" onClick={close}>
            {strings.common.cancel}
          </GlassButton>
          <GlassButton variant="primary" onClick={submit} disabled={!value.trim()}>
            {confirmLabel}
          </GlassButton>
        </>
      }
    >
      <GlassInput
        label={s.name}
        hideLabel
        placeholder={s.name}
        value={value}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        data-autofocus
      />
    </GlassDialog>
  );
}
