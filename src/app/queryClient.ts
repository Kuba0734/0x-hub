import { QueryCache, QueryClient } from "@tanstack/react-query";
import { IpcError } from "@/lib/ipc";

const noRetry = new Set(["locked", "document_locked"]);

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // A locked document was closed elsewhere (or the vault locked): refetch so the gate reappears.
    onError: (err) => {
      if (err instanceof IpcError && err.code === "document_locked") {
        void queryClient.invalidateQueries({ queryKey: ["documents", "one"] });
        void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof IpcError && noRetry.has(err.code)) && count < 1,
    },
  },
});
