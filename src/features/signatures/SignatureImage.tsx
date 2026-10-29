import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/format";
import { useObjectUrl } from "@/lib/useObjectUrl";
import { useSignatureImage } from "./queries";

/** A stored signature (black ink); `paper` shows it on a white chip so it reads on dark glass. */
export function SignatureImage({
  id,
  className,
  paper = true,
}: {
  id: string;
  className?: string;
  paper?: boolean;
}) {
  const { data } = useSignatureImage(id);
  const url = useObjectUrl(data, "image/png");
  if (!url) return <Skeleton className={cn("h-full w-full", className)} />;
  return (
    <span
      className={cn(
        "flex items-center justify-center",
        paper && "rounded-lg bg-white p-2",
        className,
      )}
    >
      <img src={url} alt="" draggable={false} className="max-h-full max-w-full object-contain" />
    </span>
  );
}
