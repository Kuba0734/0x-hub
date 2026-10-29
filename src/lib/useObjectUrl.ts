import { useEffect, useMemo } from "react";

const pendingRevokes = new Map<string, number>();

/** In-memory blob URL for decrypted bytes; revoked when the data changes or on unmount. */
export function useObjectUrl(data: ArrayBuffer | undefined, mime: string): string | null {
  const url = useMemo(
    () => (data ? URL.createObjectURL(new Blob([data], { type: mime })) : null),
    [data, mime],
  );
  useEffect(() => {
    if (!url) return;
    // StrictMode re-runs cleanup + setup on mount: cancel a revoke scheduled by that cleanup.
    window.clearTimeout(pendingRevokes.get(url));
    pendingRevokes.delete(url);
    return () => {
      pendingRevokes.set(
        url,
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
          pendingRevokes.delete(url);
        }, 0),
      );
    };
  }, [url]);
  return url;
}
