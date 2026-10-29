import { GlassButton, GlassDialog } from "@/components/glass";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { strings } from "@/lib/strings";
import { useUpdates } from "@/stores/updates";

const s = strings.updates;

/** Release notes, download progress, "Install & restart", "Skip this version". */
export function UpdateDialog() {
  const { update, status, progress, dialogOpen, closeDialog, install, skip } = useUpdates();
  const busy = status === "downloading" || status === "installing";

  return (
    <GlassDialog
      open={dialogOpen && update !== null}
      onClose={closeDialog}
      dismissible={!busy}
      layoutId="update-surface"
      width={520}
      title={update ? s.dialogTitle(update.version) : ""}
      footer={
        busy ? undefined : (
          <>
            <GlassButton variant="ghost" onClick={() => void skip()}>
              {s.skip}
            </GlassButton>
            <GlassButton onClick={closeDialog}>{s.later}</GlassButton>
            <GlassButton variant="primary" onClick={() => void install()}>
              {s.install}
            </GlassButton>
          </>
        )
      }
    >
      <h3 className="mb-2 text-[13px] font-medium tracking-normal text-fg-2">{s.releaseNotes}</h3>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-line bg-black/30 p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-fg-2 select-text">
        {update?.body?.trim() || s.noNotes}
      </div>
      {busy && (
        <div className="mt-5 flex flex-col gap-2" aria-live="polite">
          <ProgressBar value={progress} label={s.downloading} />
          <p className="text-[12px] text-fg-2">
            {status === "installing"
              ? s.installing
              : `${s.downloading} ${Math.round(progress * 100)}%`}
          </p>
        </div>
      )}
      {status === "error" && (
        <p role="alert" className="mt-4 text-[12px] font-medium">
          {s.failed}
        </p>
      )}
    </GlassDialog>
  );
}
