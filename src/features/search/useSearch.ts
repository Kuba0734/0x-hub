import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";

/** Debounced full-text search over documents, OCR text and notes. */
export function useSearch(query: string, delay = 140) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), delay);
    return () => window.clearTimeout(t);
  }, [query, delay]);

  return useQuery({
    queryKey: ["search", debounced],
    queryFn: () => ipc.search(debounced),
    enabled: debounced.length > 0,
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  });
}
