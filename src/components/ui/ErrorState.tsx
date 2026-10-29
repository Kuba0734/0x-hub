import { AlertCircle, RotateCcw } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { strings } from "@/lib/strings";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <AlertCircle className="h-7 w-7 text-fg-2" />
      <p className="text-[14px] font-medium">{strings.common.somethingWrong}</p>
      {message && <p className="max-w-sm text-[13px] text-fg-2">{message}</p>}
      {onRetry && (
        <GlassButton size="sm" icon={<RotateCcw />} onClick={onRetry}>
          {strings.common.retry}
        </GlassButton>
      )}
    </div>
  );
}
