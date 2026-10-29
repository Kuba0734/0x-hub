import { useEffect, useMemo } from "react";

/** In-memory blob URL for decrypted bytes; revoked when the data changes or on unmount. */
export function useObjectUrl(data: ArrayBuffer | undefined, mime: string): string | null {
  const url = useMemo(
    () => (data ? URL.createObjectURL(new Blob([data], { type: mime })) : null),
    [data, mime],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}
