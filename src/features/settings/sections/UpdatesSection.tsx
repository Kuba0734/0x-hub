import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { ipc } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { useUpdates } from "@/stores/updates";
import { SettingRow, SettingsGroup } from "../components/SettingsGroup";

const s = strings.settings;

export function UpdatesSection() {
  const info = useQuery({ queryKey: ["app-info"], queryFn: ipc.app.info, staleTime: Infinity });
  const status = useUpdates((st) => st.status);
  const update = useUpdates((st) => st.update);
  const check = useUpdates((st) => st.check);
  const open = useUpdates((st) => st.openDialog);
  const checking = status === "checking";

  return (
    <SettingsGroup title={s.sections.updates} description={s.updatesAuto}>
      <SettingRow
        label={info.data ? s.version(info.data.version) : ""}
        description={update ? strings.titleBar.updateAvailable(update.version) : undefined}
      >
        <div className="flex gap-2">
          {update && (
            <GlassButton variant="primary" size="sm" onClick={open}>
              {strings.updates.install}
            </GlassButton>
          )}
          <GlassButton
            size="sm"
            icon={<RefreshCw className={checking ? "animate-spin" : ""} />}
            onClick={() => void check(true)}
            disabled={checking}
          >
            {checking ? s.updatesChecking : s.updatesCheck}
          </GlassButton>
        </div>
      </SettingRow>
    </SettingsGroup>
  );
}
