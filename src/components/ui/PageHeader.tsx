import { motion } from "motion/react";
import type { ReactNode } from "react";
import { spring } from "@/components/motion/presets";
import { cn } from "@/lib/format";

interface Tab<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: Tab<T>[];
  tab?: T;
  onTab?: (t: T) => void;
  /** Unique per page so the tab indicators don't animate between pages. */
  tabsId?: string;
}

export function PageHeader<T extends string>({
  title,
  subtitle,
  actions,
  tabs,
  tab,
  onTab,
  tabsId = "tabs",
}: Props<T>) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px]">{title}</h1>
        {subtitle && <div className="mt-1 text-[13px] text-fg-2">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-3">
        {tabs && (
          <div role="tablist" className="flex rounded-full border border-line p-0.5">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => onTab?.(t.value)}
                className={cn(
                  "relative h-8 rounded-full px-3.5 text-[13px] transition-colors",
                  tab === t.value ? "text-fg" : "text-fg-3 hover:text-fg-2",
                )}
              >
                {tab === t.value && (
                  <motion.span
                    layoutId={`${tabsId}-active`}
                    transition={spring}
                    className="absolute inset-0 rounded-full bg-white/[0.1]"
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>
        )}
        {actions}
      </div>
    </header>
  );
}
