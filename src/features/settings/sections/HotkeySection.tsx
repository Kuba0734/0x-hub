import { useState } from "react";
import { GlassButton, GlassToggle } from "@/components/glass";
import { Kbd } from "@/components/ui/Kbd";
import type { AppSettings } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { acceleratorFromEvent } from "../accelerator";
import { SettingRow, SettingsGroup } from "../components/SettingsGroup";
import { useSettingsPatch } from "../useSettingsPatch";

const s = strings.settings;

function HotkeyRecorder({ value }: { value: string }) {
  const patch = useSettingsPatch();
  const [recording, setRecording] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <span className="flex gap-1">
        {value.split("+").map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
      <GlassButton
        size="sm"
        aria-live="polite"
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={async (e) => {
          if (!recording) return;
          e.preventDefault();
          e.stopPropagation();
          if (e.key === "Escape") return setRecording(false);
          const accel = acceleratorFromEvent(e.nativeEvent);
          if (!accel) return;
          setRecording(false);
          if (await patch({ hotkey: accel })) toast.show(s.hotkeySaved);
        }}
      >
        {recording ? s.hotkeyRecording : s.hotkeyRecord}
      </GlassButton>
    </div>
  );
}

export function HotkeySection({ settings }: { settings: AppSettings }) {
  const patch = useSettingsPatch();
  return (
    <SettingsGroup title={s.sections.hotkey}>
      <SettingRow label={s.hotkey} description={s.hotkeyHint}>
        <HotkeyRecorder value={settings.hotkey} />
      </SettingRow>
      <GlassToggle
        label={s.autostart}
        checked={settings.autostart}
        onChange={(v) => void patch({ autostart: v })}
      />
      <GlassToggle
        label={s.explorerIntegration}
        description={s.explorerIntegrationHint}
        checked={settings.explorerIntegration}
        onChange={(v) => void patch({ explorerIntegration: v })}
      />
      <GlassToggle
        label={s.closeToTray}
        checked={settings.closeToTray}
        onChange={(v) => void patch({ closeToTray: v })}
      />
    </SettingsGroup>
  );
}
