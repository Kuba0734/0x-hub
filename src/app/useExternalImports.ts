import { useEffect } from "react";
import { useNavigate } from "react-router";
import { ipc, onEvent, toIpcError } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useSession } from "@/stores/session";
import { toast } from "@/stores/toasts";
import { queryClient } from "./queryClient";

/** Explorer "Send to" / context-menu verb launches one process per file; batch them. */
const COLLECT_MS = 400;

/** Imports files handed over by Windows Explorer once the vault is unlocked. */
export function useExternalImports() {
  const unlocked = useSession((s) => s.phase === "unlocked");
  const navigate = useNavigate();

  useEffect(() => {
    let timer = 0;
    const run = async () => {
      const paths = await ipc.app.takePendingImports().catch(() => []);
      if (!paths.length) return;
      navigate("/documents");
      try {
        const r = await ipc.documents.import(paths);
        if (r.imported.length) toast.show(strings.documents.explorerImported(r.imported.length));
        r.failed.forEach((f) =>
          toast.error(`${strings.documents.importFailed(f.name)}: ${f.message}`),
        );
        void queryClient.invalidateQueries({ queryKey: ["documents"] });
        void queryClient.invalidateQueries({ queryKey: ["overview"] });
      } catch (e) {
        toast.error(toIpcError(e).message);
      }
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void run(), COLLECT_MS);
    };

    if (unlocked) schedule();
    const off = onEvent("import://requested", () => {
      if (unlocked) schedule();
      else toast.show(strings.documents.explorerLocked);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [unlocked, navigate]);
}
