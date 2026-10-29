import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-stroke bg-white/[0.05] px-1.5 font-mono text-[11px] text-fg-2">
      {children}
    </kbd>
  );
}
