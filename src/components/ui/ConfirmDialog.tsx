import { GlassButton, GlassDialog } from "@/components/glass";
import { strings } from "@/lib/strings";

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <GlassDialog
      open={open}
      onClose={onCancel}
      title={title}
      description={body}
      footer={
        <>
          <GlassButton variant="ghost" onClick={onCancel} data-autofocus>
            {strings.common.cancel}
          </GlassButton>
          <GlassButton variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </GlassButton>
        </>
      }
    />
  );
}
