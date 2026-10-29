import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Check, ShieldAlert } from "lucide-react";
import { GlassButton, GlassDialog } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ipc, onEvent, toIpcError, type PhoneSession } from "@/lib/ipc";
import { strings } from "@/lib/strings";

const s = strings.documents;

function useMinutesLeft(expiresAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(t);
  }, [expiresAt]);
  return expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 60_000)) : 0;
}

/** QR code + live list while the local-Wi-Fi upload server runs. Closing stops it. */
function PhoneSessionView({ onClose }: { onClose: () => void }) {
  const [session, setSession] = useState<PhoneSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stoppedUrl, setStoppedUrl] = useState<string | null>(null);
  const [received, setReceived] = useState<string[]>([]);
  const stopped = session !== null && stoppedUrl === session.url;
  const minutes = useMinutesLeft(stopped ? null : (session?.expiresAt ?? null));

  const begin = useCallback(() => {
    ipc.phone.start().then(
      (next) => setSession(next),
      (e) => setError(toIpcError(e).message),
    );
  }, []);

  const restart = () => {
    setError(null);
    begin();
  };

  useEffect(() => {
    begin();
    const offs = [
      onEvent("phone://received", (p) => setReceived((r) => [p.name, ...r])),
      onEvent("phone://stopped", (url) => setStoppedUrl(url)),
    ];
    return () => {
      offs.forEach((off) => off());
      void ipc.phone.stop();
    };
  }, [begin]);

  if (error) return <ErrorState message={error} onRetry={restart} />;

  return (
    <div className="flex gap-6">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="relative h-[220px] w-[220px] overflow-hidden rounded-2xl bg-white p-2">
          {session ? (
            // SVG produced by the backend's QR encoder from our own URL, not user input.
            <div
              aria-label={session.url}
              role="img"
              className={`h-full w-full transition-opacity [&>svg]:h-full [&>svg]:w-full ${stopped ? "opacity-10" : ""}`}
              dangerouslySetInnerHTML={{ __html: session.qrSvg.replace(/<\?xml[^>]*>/, "") }}
            />
          ) : (
            <Skeleton className="h-full w-full bg-black/10" />
          )}
        </div>
        <p className="text-[11px] text-fg-3 tabular" aria-live="polite">
          {stopped ? s.phoneStopped : session ? s.phoneExpiresIn(minutes) : strings.common.loading}
        </p>
        {stopped && (
          <GlassButton size="sm" onClick={restart}>
            {s.phoneRestart}
          </GlassButton>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 text-[13px]">
        <p className="leading-relaxed text-fg-2">{s.phoneSteps}</p>
        <p className="text-fg-2">{s.phoneSameWifi}</p>
        <p className="text-[12px] text-fg-3">{s.phoneFirewall}</p>
        <div className="flex gap-2 rounded-xl border border-white/15 bg-white/[0.04] p-3 text-[12px] leading-relaxed text-fg-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-fg" />
          {s.phoneWarning}
        </div>
        <div className="mt-1 min-h-16">
          <p className="mb-1.5 text-[12px] font-medium text-fg">
            {received.length ? s.phoneReceived(received.length) : s.phoneWaiting}
          </p>
          <ul className="flex max-h-28 flex-col gap-1 overflow-y-auto">
            <AnimatePresence initial={false}>
              {received.map((name, i) => (
                <motion.li
                  key={`${received.length - i}-${name}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={spring}
                  className="flex items-center gap-2 text-[12px] text-fg-2"
                >
                  <Check className="h-3.5 w-3.5 text-fg" />
                  <span className="truncate">{name}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
        <div className="mt-auto flex justify-end">
          <GlassButton variant="primary" onClick={onClose}>
            {s.phoneDone}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

export function PhoneUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <GlassDialog open={open} onClose={onClose} title={s.phoneTitle} width={620}>
      {open && <PhoneSessionView onClose={onClose} />}
    </GlassDialog>
  );
}
