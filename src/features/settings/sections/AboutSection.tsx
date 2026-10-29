import { useQuery } from "@tanstack/react-query";
import { ipc } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { SettingsGroup } from "../components/SettingsGroup";

const s = strings.settings;

export function AboutSection() {
  const info = useQuery({ queryKey: ["app-info"], queryFn: ipc.app.info, staleTime: Infinity });
  return (
    <SettingsGroup title={s.about}>
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[20px] font-bold text-black">
          {strings.app.mark}
        </span>
        <div>
          <p className="text-[20px] font-semibold tracking-[-0.02em]">{strings.app.name}</p>
          {info.data && <p className="text-[13px] text-fg-2">{s.version(info.data.version)}</p>}
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-fg-2">{s.privacy}</p>
      {info.data && (
        <div>
          <p className="text-[12px] text-fg-3">{s.dataLocation}</p>
          <p className="mt-0.5 font-mono text-[12px] text-fg-2 select-text">{info.data.dataDir}</p>
        </div>
      )}
      <div>
        <p className="text-[14px] text-fg">{s.licenses}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-fg-3">{s.licensesBody}</p>
      </div>
    </SettingsGroup>
  );
}
