import { QueryClient } from "@tanstack/react-query";
import { IpcError } from "@/lib/ipc";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof IpcError && err.code === "locked") && count < 1,
    },
  },
});
