import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowDownToLine, Copy, Lock, Minus, Search, Square, X } from "lucide-react";
import { spring } from "@/components/motion/presets";
import { Kbd } from "@/components/ui/Kbd";
import { ipc, inTauri } from "@/lib/ipc";
import { win } from "@/lib/platform";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/format";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";
import { useUpdates } from "@/stores/updates";

function WindowButton({
  label,
  onClick,
  children,
  close,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  close?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-[var(--titlebar-h)] w-11 items-center justify-center text-fg-2 transition-colors duration-150 hover:text-fg [&>svg]:h-3.5 [&>svg]:w-3.5",
        close ? "hover:bg-white/[0.14]" : "hover:bg-white/[0.07]",
      )}
    >
      {children}
    </button>
  );
}

/** Custom glass title bar with a drag region. Windows snap (drag to edge, Win+Arrows, Win+Z) keeps working. */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const unlocked = useSession((s) => s.phase === "unlocked");
  const setPalette = useUi((s) => s.setPalette);
  const updateStatus = useUpdates((s) => s.status);
  const update = useUpdates((s) => s.update);
  const openUpdate = useUpdates((s) => s.openDialog);
  const dialogOpen = useUpdates((s) => s.dialogOpen);

  useEffect(() => {
    if (!inTauri()) return;
    let off: (() => void) | undefined;
    const sync = () => void win.isMaximized().then(setMaximized);
    sync();
    void win.onResized(sync).then((fn) => (off = fn));
    return () => off?.();
  }, []);

  // Hidden while the dialog is open so the pill can morph into it (shared layoutId).
  const showPill =
    update &&
    !dialogOpen &&
    (updateStatus === "available" || updateStatus === "downloading" || updateStatus === "error");

  return (
    <header
      data-tauri-drag-region
      className="relative z-30 flex h-[var(--titlebar-h)] shrink-0 items-center border-b border-line bg-black/20 pl-4"
    >
      <span className="glass-backdrop" aria-hidden="true" style={{ borderRadius: 0 }} />
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.02em]"
      >
        <span className="drag-passthrough rounded-md bg-white px-1.5 py-px text-[11px] font-bold text-black">
          {strings.app.mark}
        </span>
        <span className="drag-passthrough text-fg-2">{strings.app.name}</span>
      </div>

      <div data-tauri-drag-region className="flex flex-1 justify-center">
        {unlocked && (
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="flex h-7 w-[min(420px,40vw)] items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3 text-[12px] text-fg-3 hover:bg-white/[0.07] hover:text-fg-2"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">{strings.titleBar.search}</span>
            <Kbd>Ctrl K</Kbd>
          </button>
        )}
      </div>

      <AnimatePresence>
        {showPill && (
          <motion.button
            type="button"
            layoutId="update-surface"
            onClick={openUpdate}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={spring}
            className="mr-2 flex h-7 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-medium text-black"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            {strings.titleBar.updateAvailable(update.version)}
          </motion.button>
        )}
      </AnimatePresence>

      {unlocked && (
        <WindowButton label={strings.titleBar.lock} onClick={() => void ipc.vault.lock()}>
          <Lock />
        </WindowButton>
      )}
      <WindowButton label={strings.titleBar.minimize} onClick={() => void win.minimize()}>
        <Minus />
      </WindowButton>
      <WindowButton
        label={maximized ? strings.titleBar.restore : strings.titleBar.maximize}
        onClick={() => void win.toggleMaximize()}
      >
        {maximized ? <Copy className="-scale-x-100" /> : <Square />}
      </WindowButton>
      <WindowButton label={strings.titleBar.close} onClick={() => void win.close()} close>
        <X />
      </WindowButton>
    </header>
  );
}
