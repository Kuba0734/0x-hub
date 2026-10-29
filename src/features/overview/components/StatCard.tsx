import type { ReactNode } from "react";
import { GlassCard } from "@/components/glass";
import { AnimatedNumber } from "@/components/motion";

interface Props {
  label: string;
  value: number;
  icon: ReactNode;
  format?: (n: number) => string;
  emphasis?: boolean;
}

export function StatCard({ label, value, icon, format, emphasis }: Props) {
  return (
    <GlassCard hoverable lite={false} className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between text-fg-2">
        <span className="text-[13px]">{label}</span>
        <span className={`[&>svg]:h-4 [&>svg]:w-4 ${emphasis ? "urgent-pulse text-fg" : ""}`}>
          {icon}
        </span>
      </div>
      <AnimatedNumber
        value={value}
        format={format}
        className={`text-[40px] leading-none font-semibold tracking-[-0.03em] ${emphasis ? "text-fg" : ""}`}
      />
    </GlassCard>
  );
}
