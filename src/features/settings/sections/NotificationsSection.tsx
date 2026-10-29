import { GlassToggle } from "@/components/glass";
import { cn } from "@/lib/format";
import type { AppSettings } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { SettingsGroup } from "../components/SettingsGroup";
import { useSettingsPatch } from "../useSettingsPatch";

const s = strings.settings;
const OFFSETS = [180, 90, 60, 30, 14, 7, 3, 1];

export function NotificationsSection({ settings }: { settings: AppSettings }) {
  const patch = useSettingsPatch();
  const current = settings.defaultReminderOffsets;
  const toggle = (d: number) =>
    void patch({
      defaultReminderOffsets: (current.includes(d)
        ? current.filter((o) => o !== d)
        : [...current, d]
      ).sort((a, b) => b - a),
    });

  return (
    <SettingsGroup title={s.sections.notifications}>
      <GlassToggle
        label={s.notificationsEnabled}
        description={s.notificationsHint}
        checked={settings.notificationsEnabled}
        onChange={(v) => void patch({ notificationsEnabled: v })}
      />
      <fieldset>
        <legend className="mb-2.5 text-[14px] text-fg">{s.defaultReminders}</legend>
        <div className="flex flex-wrap gap-1.5">
          {OFFSETS.map((d) => {
            const on = current.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(d)}
                className={cn(
                  "h-8 rounded-full px-3 text-[13px] transition-colors",
                  on
                    ? "bg-white font-medium text-black"
                    : "border border-line text-fg-2 hover:text-fg",
                )}
              >
                {strings.documents.daysBefore(d)}
              </button>
            );
          })}
        </div>
      </fieldset>
    </SettingsGroup>
  );
}
