import { useEffect, useRef } from "react";
import { queryClient } from "./queryClient";
import { ipc, onEvent } from "@/lib/ipc";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";
import { useUpdates } from "@/stores/updates";

const ACTIVITY_THROTTLE_MS = 30_000;
const UPDATE_DELAY_MS = 5_000;
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Backend events, activity pings for auto-lock, global keys and scheduled update checks. */
export function useAppEvents() {
  const phase = useSession((s) => s.phase);
  const setPhase = useSession((s) => s.setPhase);
  const refresh = useSession((s) => s.refresh);
  const lastPing = useRef(0);

  // Backend → frontend events.
  useEffect(() => {
    const offs = [
      onEvent("vault://locked", () => {
        setPhase("locked");
        useUi.getState().setPalette(false);
        queryClient.clear();
      }),
      onEvent("vault://unlocked", () => void refresh()),
      onEvent("vault://restored", () => {
        queryClient.clear();
        void refresh();
      }),
      onEvent("documents://changed", () => {
        void queryClient.invalidateQueries({ queryKey: ["documents"] });
        void queryClient.invalidateQueries({ queryKey: ["overview"] });
      }),
      onEvent("notes://changed", () => {
        void queryClient.invalidateQueries({ queryKey: ["notes"] });
        void queryClient.invalidateQueries({ queryKey: ["overview"] });
      }),
      onEvent("updates://check", () => void useUpdates.getState().check(true)),
    ];
    return () => offs.forEach((off) => off());
  }, [setPhase, refresh]);

  // User activity keeps the vault unlocked.
  useEffect(() => {
    if (phase !== "unlocked") return;
    const ping = () => {
      const now = Date.now();
      if (now - lastPing.current < ACTIVITY_THROTTLE_MS) return;
      lastPing.current = now;
      ipc.app.touch().catch(() => {});
    };
    const events = ["pointerdown", "keydown", "wheel", "pointermove"] as const;
    events.forEach((e) => window.addEventListener(e, ping, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, ping));
  }, [phase]);

  // Global keys: Ctrl+K palette, Ctrl+L lock.
  useEffect(() => {
    if (phase !== "unlocked") return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        const ui = useUi.getState();
        ui.setPalette(!ui.paletteOpen);
      } else if (k === "l") {
        e.preventDefault();
        ipc.vault.lock().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Update checks: after unlock (+5 s) and every 6 hours.
  useEffect(() => {
    if (phase !== "unlocked") return;
    const first = window.setTimeout(() => void useUpdates.getState().check(false), UPDATE_DELAY_MS);
    const every = window.setInterval(
      () => void useUpdates.getState().check(false),
      UPDATE_INTERVAL_MS,
    );
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [phase]);
}
