import { useEffect, useRef, useState } from "react";
import { GlassSelect, GlassSlider, GlassToggle } from "@/components/glass";
import type { AppSettings } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { glassIntensity } from "@/lib/tokens";
import { SettingRow, SettingsGroup } from "../components/SettingsGroup";
import { useSettingsPatch } from "../useSettingsPatch";

const s = strings.settings;
type Motion = "system" | "on" | "off";

export function AppearanceSection({ settings }: { settings: AppSettings }) {
  const patch = useSettingsPatch();
  const [intensity, setIntensity] = useState(settings.glassIntensity);
  const timer = useRef(0);
  const motion: Motion =
    settings.reduceMotion === null ? "system" : settings.reduceMotion ? "on" : "off";

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <SettingsGroup title={s.sections.appearance}>
      <SettingRow label={s.reduceMotion} description={s.reduceMotionHint}>
        <GlassSelect<Motion>
          label={s.reduceMotion}
          value={motion}
          onChange={(v) => void patch({ reduceMotion: v === "system" ? null : v === "on" })}
          options={[
            { value: "system", label: s.followSystem },
            { value: "on", label: s.on },
            { value: "off", label: s.off },
          ]}
        />
      </SettingRow>
      <GlassSlider
        label={s.glassIntensity}
        description={s.glassIntensityHint}
        value={intensity}
        min={glassIntensity.min}
        max={glassIntensity.max}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => {
          setIntensity(v);
          // Live preview now, persist once the slider settles.
          document.documentElement.style.setProperty("--glass-intensity", String(v));
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => void patch({ glassIntensity: v }), 300);
        }}
      />
      <GlassToggle
        label={s.animatedBackground}
        description={s.animatedBackgroundHint}
        checked={settings.animatedBackground}
        onChange={(v) => void patch({ animatedBackground: v })}
      />
      <GlassToggle
        label={s.sidebarDefault}
        checked={settings.sidebarCollapsed}
        onChange={(v) => void patch({ sidebarCollapsed: v })}
      />
    </SettingsGroup>
  );
}
