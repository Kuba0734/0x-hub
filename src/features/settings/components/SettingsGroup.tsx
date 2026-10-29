import type { ReactNode } from "react";
import { GlassPanel } from "@/components/glass";

export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <GlassPanel refract={false} radius={20} className="p-6">
      <h2 className="text-[16px]">{title}</h2>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{description}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </GlassPanel>
  );
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <p className="text-[14px] text-fg">{label}</p>
        {description && <p className="mt-0.5 text-[12px] text-fg-3">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
