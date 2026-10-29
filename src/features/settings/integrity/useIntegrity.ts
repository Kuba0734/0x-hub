import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ipc, onEvent, toIpcError } from "@/lib/ipc";
import { useSettings } from "@/stores/settings";
import { toast } from "@/stores/toasts";

const reportKey = ["integrity", "report"] as const;

/** Last report, "check now", and live progress (also of scheduled background checks). */
export function useIntegrity() {
  const qc = useQueryClient();
  const report = useQuery({ queryKey: reportKey, queryFn: ipc.integrity.lastReport });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    const offs = [
      onEvent("progress://integrity", (p) => setProgress(p)),
      onEvent("integrity://finished", (r) => {
        setProgress(null);
        qc.setQueryData(reportKey, r);
        // `lastRunAt` changed in the backend.
        void useSettings.getState().load();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [qc]);

  const run = useMutation({
    mutationFn: ipc.integrity.run,
    onMutate: () => setProgress({ done: 0, total: 0 }),
    onSuccess: (r) => qc.setQueryData(reportKey, r),
    onSettled: () => setProgress(null),
    onError: (e) => toast.error(toIpcError(e).message),
  });

  return { report: report.data ?? null, progress, run };
}
